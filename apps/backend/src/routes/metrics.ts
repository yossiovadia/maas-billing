import express from 'express';
import { MetricsService } from '../services/metricsService';
import { logger } from '../utils/logger';

const router = express.Router();
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

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const status = await metricsService.getMetricsStatus();
    const requests = await metricsService.getRealLiveRequests();
    
    const totalRequests = requests.length;
    const acceptedRequests = requests.filter(r => r.decision === 'accept').length;
    const rejectedRequests = requests.filter(r => r.decision === 'reject').length;
    const policyEnforcedRequests = requests.filter(r => r.policyType && r.policyType !== 'None').length;

    res.json({
      success: true,
      data: {
        totalRequests,
        acceptedRequests,
        rejectedRequests,
        policyEnforcedRequests,
        kuadrantStatus: {
          limitadorConnected: status.limitadorConnected,
          authorinoConnected: status.authorinoConnected,
          hasRealTraffic: status.hasRealTraffic
        },
        lastUpdate: status.lastUpdate
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