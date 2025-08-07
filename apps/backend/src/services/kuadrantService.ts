import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface KuadrantPolicy {
  id: string;
  name: string;
  description: string;
  type: 'auth' | 'rateLimit';
  namespace: string;
  targetRef: {
    group: string;
    kind: string;
    name: string;
  };
  config: any;
  status: {
    conditions: Array<{
      type: string;
      status: string;
      reason: string;
      message: string;
      lastTransitionTime: string;
    }>;
  };
  created: string;
  modified: string;
  isActive: boolean;
  items?: Array<{
    id: string;
    type: string;
    value: string;
    isApprove: boolean;
  }>;
  requestLimits?: {
    tokenLimit: number;
    timePeriod: string;
  } | undefined;
  timeRange?: {
    startTime: string;
    endTime: string;
    unlimited: boolean;
  };
}

class KuadrantService {
  
  async getAuthPolicies(): Promise<KuadrantPolicy[]> {
    try {
      logger.info('Fetching AuthPolicies from Kuadrant...');
      
      const output = execSync('kubectl get authpolicies -A -o json', { encoding: 'utf-8' });
      const result = JSON.parse(output);
      
      return result.items.map((item: any) => this.convertAuthPolicyToPolicy(item));
    } catch (error) {
      logger.error('Failed to fetch AuthPolicies:', error);
      return [];
    }
  }

  async getRateLimitPolicies(): Promise<KuadrantPolicy[]> {
    try {
      logger.info('Fetching RateLimitPolicies from Kuadrant...');
      
      const output = execSync('kubectl get ratelimitpolicies -A -o json', { encoding: 'utf-8' });
      const result = JSON.parse(output);
      
      // Flatten the array since each policy now returns multiple entries
      const allPolicies: KuadrantPolicy[] = [];
      result.items.forEach((item: any) => {
        const policies = this.convertRateLimitPolicyToPolicy(item);
        allPolicies.push(...policies);
      });
      
      return allPolicies;
    } catch (error) {
      logger.error('Failed to fetch RateLimitPolicies:', error);
      return [];
    }
  }

  async getAllPolicies(): Promise<KuadrantPolicy[]> {
    const [authPolicies, rateLimitPolicies] = await Promise.all([
      this.getAuthPolicies(),
      this.getRateLimitPolicies()
    ]);
    
    return [...authPolicies, ...rateLimitPolicies];
  }

  private convertAuthPolicyToPolicy(authPolicy: any): KuadrantPolicy {
    const metadata = authPolicy.metadata;
    const spec = authPolicy.spec;
    const status = authPolicy.status || {};
    
    // Extract team/user groups from OPA policy if available
    const items: any[] = [];
    if (spec.rules?.authorization?.['allow-groups']?.opa?.rego) {
      const rego = spec.rules.authorization['allow-groups'].opa.rego;
      const groupMatches = rego.match(/groups\[_\] == "([^"]+)"/g);
      if (groupMatches) {
        groupMatches.forEach((match: string, index: number) => {
          const group = match.match(/"([^"]+)"/)?.[1];
          if (group) {
            items.push({
              id: `auth-item-${index}`,
              type: 'tier',
              value: group,
              isApprove: true
            });
          }
        });
      }
    }

    return {
      id: `authpolicy-${metadata.name}`,
      name: metadata.name,
      description: `API key authentication for ${items.length > 0 ? items.map(i => i.value).join(', ') : 'all'} tiers`,
      type: 'auth',
      namespace: metadata.namespace,
      targetRef: spec.targetRef,
      config: {
        auth: {
          type: spec.rules?.authentication ? 'api-key' : 'none',
          required: !!spec.rules?.authentication
        },
        rules: spec.rules
      },
      status: {
        conditions: status.conditions || []
      },
      created: metadata.creationTimestamp,
      modified: metadata.creationTimestamp,
      isActive: this.isPolicyActive(status),
      items,
      // Auth policies don't have request limits - only control access
      requestLimits: undefined,
      timeRange: {
        startTime: '00:00',
        endTime: '23:59',
        unlimited: true
      }
    };
  }

  private convertRateLimitPolicyToPolicy(rateLimitPolicy: any): KuadrantPolicy[] {
    const metadata = rateLimitPolicy.metadata;
    const spec = rateLimitPolicy.spec;
    const status = rateLimitPolicy.status || {};
    
    const policies: KuadrantPolicy[] = [];

    // Create a separate policy entry for each rate limit rule
    if (spec.limits) {
      Object.entries(spec.limits).forEach(([limitName, limitConfig]: [string, any], index: number) => {
        // Extract group from predicate if available
        let groupName = 'unknown';
        if (limitConfig.when && limitConfig.when[0]?.predicate) {
          const predicate = limitConfig.when[0].predicate;
          const groupMatch = predicate.match(/g == "([^"]+)"/);
          if (groupMatch) {
            groupName = groupMatch[1];
          }
        }

        const rateConfig = limitConfig.rates?.[0];
        
        policies.push({
          id: `ratelimitpolicy-${metadata.name}-${groupName}`,
          name: `${limitName}`,
          description: `Rate limiting for ${groupName} tier`,
          type: 'rateLimit',
          namespace: metadata.namespace,
          targetRef: spec.targetRef,
          config: {
            rateLimit: {
              requests: rateConfig?.limit || 100,
              duration: rateConfig?.window || '1h',
              unit: 'requests'
            },
            limitRule: limitConfig
          },
          status: {
            conditions: status.conditions || []
          },
          created: metadata.creationTimestamp,
          modified: metadata.creationTimestamp,
          isActive: this.isPolicyActive(status),
          items: [{
            id: `rate-limit-item-${index}`,
            type: 'tier',
            value: groupName,
            isApprove: true
          }],
          requestLimits: {
            tokenLimit: rateConfig?.limit || 100,
            timePeriod: this.convertWindowToPeriod(rateConfig?.window || '1h')
          },
          timeRange: {
            startTime: '00:00',
            endTime: '23:59',
            unlimited: true
          }
        });
      });
    }

    return policies;
  }

  private isPolicyActive(status: any): boolean {
    const enforcedCondition = status.conditions?.find((c: any) => c.type === 'Enforced');
    return enforcedCondition?.status === 'True';
  }

  private convertWindowToPeriod(window: string): string {
    // Parse the window string to get the actual time period
    const match = window.match(/(\d+)([mhd])/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      switch (unit) {
        case 'm':
          return value === 1 ? 'minute' : `${value} minutes`;
        case 'h':
          return value === 1 ? 'hour' : `${value} hours`;
        case 'd':
          return value === 1 ? 'day' : `${value} days`;
        default:
          return window;
      }
    }
    return window;
  }

  async createAuthPolicy(policyData: any): Promise<any> {
    // TODO: Implement AuthPolicy creation via kubectl
    logger.info('Creating AuthPolicy:', policyData);
    throw new Error('AuthPolicy creation not yet implemented');
  }

  async createRateLimitPolicy(policyData: any): Promise<any> {
    // TODO: Implement RateLimitPolicy creation via kubectl
    logger.info('Creating RateLimitPolicy:', policyData);
    throw new Error('RateLimitPolicy creation not yet implemented');
  }

  async updatePolicy(policyId: string, policyData: any): Promise<any> {
    // TODO: Implement policy update via kubectl
    logger.info(`Updating policy ${policyId}:`, policyData);
    throw new Error('Policy update not yet implemented');
  }

  async deletePolicy(policyId: string): Promise<void> {
    // TODO: Implement policy deletion via kubectl
    logger.info(`Deleting policy ${policyId}`);
    throw new Error('Policy deletion not yet implemented');
  }
}

export const kuadrantService = new KuadrantService();