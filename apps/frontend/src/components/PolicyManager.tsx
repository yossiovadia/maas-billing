import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  Grid,
  IconButton,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Memory as ModelIcon,
} from '@mui/icons-material';

import { Policy, Team, Model } from '../types';
import { teams, models } from '../data/mockData';
import PolicyBuilder from './PolicyBuilder';
import apiService from '../services/api';

const PolicyManager: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filteredPolicies, setFilteredPolicies] = useState<Policy[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        setLoading(true);
        const data = await apiService.getPolicies();
        setPolicies(data);
        setFilteredPolicies(data);
      } catch (error) {
        console.error('Failed to fetch policies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  useEffect(() => {
    const filtered = policies.filter(policy =>
      policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPolicies(filtered);
  }, [searchTerm, policies]);

  const handleCreatePolicy = () => {
    setSelectedPolicy(null);
    setIsBuilderOpen(true);
  };

  const handleEditPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setIsBuilderOpen(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    try {
      await apiService.deletePolicy(policyId);
      setPolicies(prev => prev.filter(p => p.id !== policyId));
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  };

  const handleSavePolicy = async (policy: Policy) => {
    try {
      if (selectedPolicy) {
        // Update existing policy
        const updatedPolicy = await apiService.updatePolicy(policy.id, policy);
        setPolicies(prev => prev.map(p => p.id === policy.id ? updatedPolicy : p));
      } else {
        // Create new policy
        const newPolicy = await apiService.createPolicy(policy);
        setPolicies(prev => [...prev, newPolicy]);
      }
      setIsBuilderOpen(false);
      setSelectedPolicy(null);
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || teamId;
  };

  const getTeamColor = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.color || '#666';
  };

  const getModelName = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  const formatTimeRange = (policy: Policy) => {
    if (policy.timeRange.unlimited) {
      return 'Unlimited';
    }
    return `${policy.timeRange.startTime} - ${policy.timeRange.endTime}`;
  };

  const formatRequestLimits = (policy: Policy) => {
    if (policy.requestLimits.tokenLimit === null) {
      return 'Unlimited';
    }
    return `${policy.requestLimits.tokenLimit.toLocaleString()} tokens/${policy.requestLimits.timePeriod}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading policies...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Policy Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreatePolicy}
          sx={{ ml: 2 }}
        >
          Create Policy
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search policies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Box>

      {/* Policies Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Teams & Models</TableCell>
              <TableCell>Request Limits</TableCell>
              <TableCell>Time Range</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPolicies.map((policy) => (
              <TableRow key={policy.id} hover>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {policy.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {policy.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {policy.items.map((item) => (
                      <Chip
                        key={item.id}
                        size="small"
                        icon={item.type === 'team' ? <GroupIcon /> : <ModelIcon />}
                        label={
                          item.type === 'team' 
                            ? getTeamName(item.value)
                            : getModelName(item.value)
                        }
                        color={item.isApprove ? 'success' : 'error'}
                        variant={item.isApprove ? 'filled' : 'outlined'}
                        sx={{
                          ...(item.type === 'team' && {
                            backgroundColor: item.isApprove ? getTeamColor(item.value) : 'transparent',
                            borderColor: getTeamColor(item.value),
                          })
                        }}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatRequestLimits(policy)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {formatTimeRange(policy)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={policy.isActive ? 'Active' : 'Inactive'}
                    color={policy.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit Policy">
                    <IconButton
                      size="small"
                      onClick={() => handleEditPolicy(policy)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Policy">
                    <IconButton
                      size="small"
                      onClick={() => handleDeletePolicy(policy.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Empty State */}
      {filteredPolicies.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            bgcolor: 'background.paper',
            borderRadius: 1,
            mt: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No policies found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {searchTerm ? 'Try adjusting your search criteria' : 'Get started by creating your first policy'}
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePolicy}
            >
              Create Policy
            </Button>
          )}
        </Box>
      )}

      {/* Policy Builder Dialog */}
      <PolicyBuilder
        open={isBuilderOpen}
        policy={selectedPolicy}
        teams={teams}
        models={models}
        onSave={handleSavePolicy}
        onClose={() => {
          setIsBuilderOpen(false);
          setSelectedPolicy(null);
        }}
      />
    </Box>
  );
};

export default PolicyManager;