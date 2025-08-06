export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

export interface PolicyItem {
  id: string;
  type: 'team' | 'model';
  value: string;
  isApprove: boolean; // true for approve policy, false for reject policy
}

export interface RequestLimits {
  tokenLimit: number | null; // null means unlimited
  timePeriod: 'hour' | 'day' | 'week' | 'month';
}

export interface TimeRange {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  unlimited: boolean;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: 'auth' | 'rateLimit';
  config: {
    auth?: {
      type: string;
      required: boolean;
    };
    rateLimit?: {
      requests: number;
      duration: string;
      unit: string;
    };
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Legacy properties for compatibility with mock data
  items?: PolicyItem[];
  requestLimits?: RequestLimits;
  timeRange?: TimeRange;
  created?: string;
  modified?: string;
}

export interface Request {
  id: string;
  team: string;
  model: string;
  timestamp: string;
  decision: 'accept' | 'reject';
  policyType?: 'AuthPolicy' | 'RateLimitPolicy' | 'None';
  reason?: string;
  queryText?: string;
  tokens?: number;
}

export interface SimulationRequest {
  team: string;
  model: string;
  timeOfDay: string;
  queryText: string;
  count: number;
}