import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Toolbar,
} from '@mui/material';
import {
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  Security as PolicyIcon,
  Speed as RateLimitIcon,
  Circle as DotIcon,
} from '@mui/icons-material';

import { useLiveRequests } from '../hooks/useApi';
import { Request } from '../types';

const MetricsDashboard: React.FC = () => {
  const { requests, loading, error } = useLiveRequests(true);
  const [filterByDecision, setFilterByDecision] = useState<'all' | 'accept' | 'reject'>('all');
  const [filterByPolicy, setFilterByPolicy] = useState<'all' | 'AuthPolicy' | 'RateLimitPolicy' | 'None'>('all');

  const filteredRequests = requests.filter((request: Request) => {
    const decisionMatch = filterByDecision === 'all' || request.decision === filterByDecision;
    const policyMatch = filterByPolicy === 'all' || request.policyType === filterByPolicy;
    return decisionMatch && policyMatch;
  });

  const getPolicyChipProps = (policyType?: string) => {
    switch (policyType) {
      case 'AuthPolicy':
        return { color: 'primary' as const, icon: <PolicyIcon /> };
      case 'RateLimitPolicy':
        return { color: 'warning' as const, icon: <RateLimitIcon /> };
      case 'None':
        return { color: 'success' as const, icon: <AcceptIcon /> };
      default:
        return { color: 'default' as const, icon: undefined };
    }
  };

  const getDecisionChipProps = (decision: string) => {
    return decision === 'accept' 
      ? { color: 'success' as const, icon: <AcceptIcon /> }
      : { color: 'error' as const, icon: <RejectIcon /> };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading live metrics...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6">Error Loading Metrics</Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  const totalRequests = filteredRequests.length;
  const acceptedRequests = filteredRequests.filter(r => r.decision === 'accept').length;
  const rejectedRequests = filteredRequests.filter(r => r.decision === 'reject').length;
  const policyEnforcedRequests = filteredRequests.filter(r => r.policyType && r.policyType !== 'None').length;

  return (
    <Box>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        Live Request Metrics
      </Typography>
      
      {/* Filters */}
      <Toolbar sx={{ px: 0, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
          <InputLabel>Decision</InputLabel>
          <Select
            value={filterByDecision}
            onChange={(e) => setFilterByDecision(e.target.value as any)}
            label="Decision"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="accept">Accept</MenuItem>
            <MenuItem value="reject">Reject</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Policy Type</InputLabel>
          <Select
            value={filterByPolicy}
            onChange={(e) => setFilterByPolicy(e.target.value as any)}
            label="Policy Type"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="AuthPolicy">Auth Policy</MenuItem>
            <MenuItem value="RateLimitPolicy">Rate Limit Policy</MenuItem>
            <MenuItem value="None">No Policy</MenuItem>
          </Select>
        </FormControl>
      </Toolbar>

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Requests
              </Typography>
              <Typography variant="h4" component="div">
                {totalRequests}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Accepted
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {acceptedRequests}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Rejected
              </Typography>
              <Typography variant="h4" component="div" color="error.main">
                {rejectedRequests}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Policy Enforced
              </Typography>
              <Typography variant="h4" component="div" color="primary.main">
                {policyEnforcedRequests}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Requests Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Request</TableCell>
              <TableCell>Decision</TableCell>
              <TableCell>Policy</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell align="right">Tokens</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No requests found with current filters
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request: Request) => {
                const policyProps = getPolicyChipProps(request.policyType);
                const decisionProps = getDecisionChipProps(request.decision);
                
                return (
                  <TableRow key={request.id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(request.timestamp).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={request.team}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {request.model}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          maxWidth: 200, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {request.queryText || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.decision}
                        color={decisionProps.color}
                        size="small"
                        icon={decisionProps.icon}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.policyType || 'Unknown'}
                        color={policyProps.color}
                        size="small"
                        icon={policyProps.icon}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          maxWidth: 200, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {request.reason || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {request.tokens || 0}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Real-time indicator */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'success.main',
              mr: 1,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Live updates every 2 seconds
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredRequests.length} of {requests.length} total requests
        </Typography>
      </Box>
    </Box>
  );
};

export default MetricsDashboard;