import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from '@mui/icons-material';

import { teams, models } from '../data/mockData';
import { SimulationRequest } from '../types';

const RequestSimulator: React.FC = () => {
  const [simulationForm, setSimulationForm] = useState<SimulationRequest>({
    team: '',
    model: '',
    timeOfDay: new Date().toTimeString().slice(0, 5),
    queryText: '',
    count: 1,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleInputChange = (field: keyof SimulationRequest, value: any) => {
    setSimulationForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRunSimulation = async () => {
    if (!simulationForm.team || !simulationForm.model || !simulationForm.queryText) {
      return;
    }

    setIsRunning(true);
    
    try {
      // TODO: Replace with real Kuadrant policy simulation
      // For now, simulate some results
      const simulatedResults = Array.from({ length: simulationForm.count }, (_, i) => ({
        id: `sim-${Date.now()}-${i}`,
        team: simulationForm.team,
        model: simulationForm.model,
        timestamp: new Date().toISOString(),
        decision: Math.random() > 0.3 ? 'accept' : 'reject',
        policyType: Math.random() > 0.5 ? 'AuthPolicy' : 'RateLimitPolicy',
        reason: Math.random() > 0.3 ? 'Request approved' : 'Policy violation detected',
        queryText: simulationForm.queryText,
        tokens: Math.floor(Math.random() * 1000) + 50,
      }));

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setResults(simulatedResults);
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopSimulation = () => {
    setIsRunning(false);
  };

  const canRunSimulation = simulationForm.team && simulationForm.model && simulationForm.queryText && !isRunning;

  return (
    <Box>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        Request Simulator
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Test your policies by simulating requests and seeing how they would be handled by Kuadrant.
      </Typography>

      {/* Simulation Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Simulation Parameters
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Team</InputLabel>
                <Select
                  value={simulationForm.team}
                  onChange={(e) => handleInputChange('team', e.target.value)}
                  label="Team"
                >
                  {teams.map(team => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={simulationForm.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  label="Model"
                >
                  {models.map(model => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Time of Day"
                type="time"
                value={simulationForm.timeOfDay}
                onChange={(e) => handleInputChange('timeOfDay', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Request Count"
                type="number"
                value={simulationForm.count}
                onChange={(e) => handleInputChange('count', parseInt(e.target.value) || 1)}
                inputProps={{ min: 1, max: 100 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Query Text"
                value={simulationForm.queryText}
                onChange={(e) => handleInputChange('queryText', e.target.value)}
                placeholder="Enter the request you want to simulate..."
                multiline
                rows={2}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={handleRunSimulation}
                  disabled={!canRunSimulation}
                >
                  {isRunning ? 'Running...' : 'Run Simulation'}
                </Button>
                
                {isRunning && (
                  <Button
                    variant="outlined"
                    startIcon={<StopIcon />}
                    onClick={handleStopSimulation}
                    color="error"
                  >
                    Stop
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Simulation Results
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              This is a simulation using mock data. In a real implementation, this would test against actual Kuadrant policies.
            </Alert>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Decision</TableCell>
                    <TableCell>Policy</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Tokens</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={result.team} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{result.model}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={result.decision}
                          color={result.decision === 'accept' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={result.policyType}
                          color={result.policyType === 'AuthPolicy' ? 'primary' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {result.reason}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{result.tokens}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RequestSimulator;