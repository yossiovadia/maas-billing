import express from 'express';
import { MetricsService } from '../services/metricsService';
import { logger } from '../utils/logger';

const router: express.Router = express.Router();
const metricsService = new MetricsService();

// Get live requests with policy enforcement data
router.get('/live-requests', async (req, res) => {
  try {
    const requests = await metricsService.getRealLiveRequests();
    res.json({
      success: true,
      data: requests,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch live requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live requests'
    });
  }
});

// Get detailed request information by ID
router.get('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requests = await metricsService.getRealLiveRequests();
    const request = requests.find(r => r.id === id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    res.json({
      success: true,
      data: request,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch request details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch request details'
    });
  }
});

// Get aggregated policy enforcement statistics
router.get('/policy-stats', async (req, res) => {
  try {
    const requests = await metricsService.getRealLiveRequests();
    
    const stats = {
      totalRequests: requests.length,
      approvedRequests: requests.filter(r => r.decision === 'accept').length,
      rejectedRequests: requests.filter(r => r.decision === 'reject').length,
      policyDecisions: {
        authPolicy: {
          total: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.policyType === 'AuthPolicy').length, 0),
          allowed: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.policyType === 'AuthPolicy' && p.decision === 'allow').length, 0),
          denied: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.policyType === 'AuthPolicy' && p.decision === 'deny').length, 0)
        },
        rateLimitPolicy: {
          total: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.policyType === 'RateLimitPolicy').length, 0),
          allowed: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.policyType === 'RateLimitPolicy' && p.decision === 'allow').length, 0),
          denied: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.policyType === 'RateLimitPolicy' && p.decision === 'deny').length, 0)
        }
      },
      enforcementPoints: {
        authorino: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.enforcementPoint === 'authorino').length, 0),
        limitador: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.enforcementPoint === 'limitador').length, 0),
        envoy: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.enforcementPoint === 'envoy').length, 0),
        opa: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.enforcementPoint === 'opa').length, 0),
        kuadrant: requests.reduce((sum, r) => sum + r.policyDecisions.filter(p => p.enforcementPoint === 'kuadrant').length, 0)
      },
      modelInferences: {
        total: requests.filter(r => r.modelInference).length,
        totalTokens: requests.reduce((sum, r) => sum + (r.modelInference?.totalTokens || 0), 0),
        avgResponseTime: requests.filter(r => r.modelInference).reduce((sum, r) => sum + (r.modelInference?.responseTime || 0), 0) / Math.max(1, requests.filter(r => r.modelInference).length),
        totalCost: requests.reduce((sum, r) => sum + (r.estimatedCost || 0), 0)
      },
      authentication: {
        apiKey: requests.filter(r => r.authentication?.method === 'api-key').length,
        none: requests.filter(r => r.authentication?.method === 'none').length,
        valid: requests.filter(r => r.authentication?.isValid).length,
        invalid: requests.filter(r => r.authentication && !r.authentication.isValid).length
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch policy stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch policy statistics'
    });
  }
});

// Get dashboard statistics from real Prometheus metrics
router.get('/dashboard', async (req, res) => {
  try {
    // Get real data from Prometheus sources
    const [istioMetrics, authorinoMetrics, status] = await Promise.all([
      metricsService.fetchIstioMetrics(),
      metricsService.fetchAuthorinoMetrics(),
      metricsService.getMetricsStatus()
    ]);

    // Calculate totals from real Prometheus data
    let totalRequests = 0;
    let acceptedRequests = 0;
    let authFailedRequests = 0;
    let rateLimitedRequests = 0;
    let rejectedRequests = 0;

    if (istioMetrics) {
      // Use real Istio metrics for accurate counts
      acceptedRequests = istioMetrics.successRequests || 0;
      authFailedRequests = istioMetrics.authFailedRequests || 0;
      rateLimitedRequests = istioMetrics.rateLimitedRequests || 0;
      rejectedRequests = authFailedRequests + rateLimitedRequests + (istioMetrics.notFoundRequests || 0);
      totalRequests = acceptedRequests + rejectedRequests;
    }

    // Enhanced status with real metrics sources
    const enhancedStatus = {
      ...status,
      istioConnected: istioMetrics !== null,
      metricsSource: istioMetrics ? 'istio-prometheus' : 'fallback',
      realData: totalRequests > 0
    };
    
    res.json({
      success: true,
      data: {
        // Real metrics from Prometheus
        totalRequests,
        acceptedRequests,
        rejectedRequests,
        authFailedRequests,
        rateLimitedRequests,
        policyEnforcedRequests: authFailedRequests + rateLimitedRequests,
        
        // Enhanced status
        kuadrantStatus: enhancedStatus,
        
        // Real Authorino controller metrics from Prometheus
        authorinoStats: authorinoMetrics ? {
          authConfigs: Array.from(authorinoMetrics.authByNamespace?.keys() || []).length,
          totalEvaluations: authorinoMetrics.authRequests || 0,
          successfulReconciles: authorinoMetrics.authSuccesses || 0,
          failedReconciles: authorinoMetrics.authFailures || 0,
          // Additional controller metrics
          reconcileOperations: authorinoMetrics.totalReconciles || 0,
          avgReconcileTime: authorinoMetrics.avgReconcileTime || 0
        } : {
          authConfigs: 0,
          totalEvaluations: 0,
          successfulReconciles: 0,
          failedReconciles: 0,
          reconcileOperations: 0,
          avgReconcileTime: 0
        },
        
        lastUpdate: new Date().toISOString(),
        source: 'prometheus-metrics'
      }
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

// Get general metrics with time range
router.get('/', async (req, res) => {
  try {
    const timeRange = req.query.timeRange as string || '1h';
    const status = await metricsService.getMetricsStatus();
    
    res.json({
      success: true,
      data: {
        timeRange,
        kuadrantStatus: status,
        message: 'Metrics endpoint active'
      }
    });
  } catch (error) {
    logger.error('Failed to fetch metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

export default router;