import PQueue from 'p-queue';
import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface QueueRequest {
  id: string;
  tier: 'enterprise' | 'premium' | 'free';
  prompt: string;
  timestamp: number;
  resolve: (response: any) => void;
  reject: (error: Error) => void;
}

interface QoSMetrics {
  totalRequests: number;
  activeRequests: number;
  enterpriseQueue: number;
  premiumQueue: number;
  freeQueue: number;
  avgResponseTime: number;
}

export class QoSService extends EventEmitter {
  private enterpriseQueue: PQueue;
  private premiumQueue: PQueue;
  private freeQueue: PQueue;
  private metrics: QoSMetrics;
  private simulationMode: boolean;
  private modelEndpoint: string;
  
  constructor() {
    super();
    this.simulationMode = process.env.SIMULATION_MODE === 'true';
    this.modelEndpoint = 'http://localhost:8004';
    
    // Create priority queues with different concurrency
    this.enterpriseQueue = new PQueue({ 
      concurrency: 3         // Enterprise gets most resources
    });
    
    this.premiumQueue = new PQueue({ 
      concurrency: 2         // Premium gets medium resources  
    });
    
    this.freeQueue = new PQueue({ 
      concurrency: 1         // Free gets least resources
    });
    
    this.metrics = {
      totalRequests: 0,
      activeRequests: 0,
      enterpriseQueue: 0,
      premiumQueue: 0,
      freeQueue: 0,
      avgResponseTime: 0
    };
    
    this.setupEventHandlers();
    logger.info('QoS Service initialized with p-queue', {
      simulationMode: this.simulationMode,
      endpoint: this.modelEndpoint
    });
  }
  
  /**
   * Process request with proper priority queuing
   */
  async processRequest(
    id: string,
    tier: 'enterprise' | 'premium' | 'free',
    prompt: string,
    userContext: any
  ): Promise<any> {
    const startTime = Date.now();
    
    logger.info('Processing QoS request', {
      requestId: id,
      tier,
      queueSizes: this.getQueueSizes()
    });
    
    this.metrics.totalRequests++;
    
    return new Promise((resolve, reject) => {
      const queueRequest: QueueRequest = {
        id,
        tier,
        prompt,
        timestamp: startTime,
        resolve,
        reject
      };
      
      // Route to appropriate priority queue
      const queue = this.selectQueue(tier);
      const priority = this.calculatePriority(tier, startTime);
      
      // Add to queue with priority
      queue.add(
        () => this.executeRequest(queueRequest),
        { priority }
      ).then(resolve).catch(reject);
      
      this.updateQueueMetrics();
    });
  }
  
  /**
   * Execute the actual request (simulation or real LLM)
   */
  private async executeRequest(request: QueueRequest): Promise<any> {
    const startTime = Date.now();
    this.metrics.activeRequests++;
    
    try {
      let response;
      
      if (this.simulationMode) {
        response = await this.simulateResponse(request);
      } else {
        response = await this.callLLM(request);
      }
      
      const processingTime = Date.now() - startTime;
      const queueTime = startTime - request.timestamp;
      
      logger.info('Request completed', {
        requestId: request.id,
        tier: request.tier,
        processingTime,
        queueTime,
        simulation: this.simulationMode
      });
      
      this.updateMetrics(processingTime);
      return response;
      
    } finally {
      this.metrics.activeRequests--;
    }
  }
  
  /**
   * Simulate LLM response for testing
   */
  private async simulateResponse(request: QueueRequest): Promise<any> {
    // Realistic delay based on tier (Enterprise gets faster "hardware")
    const delay = request.tier === 'enterprise' ? 2000 : 
                  request.tier === 'premium' ? 3000 : 4000;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      id: `sim-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt2-medium-sim',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `Simulated ${request.tier.toUpperCase()} response: ${request.prompt.substring(0, 50)}... [Priority processing completed]`
        },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    };
  }
  
  /**
   * Call real LLM model
   */
  private async callLLM(request: QueueRequest): Promise<any> {
    try {
      const response = await axios.post(`${this.modelEndpoint}/v1/chat/completions`, {
        model: 'gpt2-medium',
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: 50,
        temperature: 0.7
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000 // 3 minutes
      });
      
      return response.data;
      
    } catch (error: any) {
      logger.error('LLM request failed', {
        requestId: request.id,
        error: error.message,
        endpoint: this.modelEndpoint
      });
      throw error;
    }
  }
  
  /**
   * Select appropriate queue based on tier
   */
  private selectQueue(tier: string): PQueue {
    switch (tier) {
      case 'enterprise': return this.enterpriseQueue;
      case 'premium': return this.premiumQueue;  
      case 'free': return this.freeQueue;
      default: return this.freeQueue;
    }
  }
  
  /**
   * Calculate priority score (higher = more important)
   */
  private calculatePriority(tier: string, timestamp: number): number {
    const basePriority = {
      enterprise: 100,
      premium: 50,
      free: 10
    }[tier] || 10;
    
    // Add slight aging bonus to prevent starvation
    const age = Date.now() - timestamp;
    const agingBonus = Math.min(age / 1000, 20); // Max 20 point bonus
    
    return basePriority + agingBonus;
  }
  
  /**
   * Update queue size metrics
   */
  private updateQueueMetrics(): void {
    this.metrics.enterpriseQueue = this.enterpriseQueue.size;
    this.metrics.premiumQueue = this.premiumQueue.size;
    this.metrics.freeQueue = this.freeQueue.size;
  }
  
  /**
   * Update performance metrics
   */
  private updateMetrics(processingTime: number): void {
    // Simple moving average for response time
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * 0.9) + (processingTime * 0.1);
  }
  
  /**
   * Get current queue sizes
   */
  private getQueueSizes(): Record<string, number> {
    return {
      enterprise: this.enterpriseQueue.size,
      premium: this.premiumQueue.size,
      free: this.freeQueue.size
    };
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics(): QoSMetrics {
    this.updateQueueMetrics();
    return { ...this.metrics };
  }
  
  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Monitor queue events
    [this.enterpriseQueue, this.premiumQueue, this.freeQueue].forEach((queue, index) => {
      const tier = ['enterprise', 'premium', 'free'][index];
      
      queue.on('active', () => {
        logger.debug(`${tier} queue processing started`, {
          queueSize: queue.size,
          pending: queue.pending
        });
      });
      
      queue.on('idle', () => {
        logger.debug(`${tier} queue idle`, {
          queueSize: queue.size
        });
      });
    });
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; metrics: QoSMetrics }> {
    return {
      status: 'healthy',
      metrics: this.getMetrics()
    };
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down QoS Service...');
    
    // Wait for all queues to finish
    await Promise.all([
      this.enterpriseQueue.onIdle(),
      this.premiumQueue.onIdle(), 
      this.freeQueue.onIdle()
    ]);
    
    logger.info('QoS Service shutdown complete');
  }
}