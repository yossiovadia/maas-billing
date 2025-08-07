import React, { useState } from 'react';
import {
  AppBar,
  Box,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Avatar,
} from '@mui/material';
import {
  Policy as PolicyIcon,
  BarChart as MetricsIcon,
  PlayArrow as SimulatorIcon,
  AccountCircle,
  Settings,
  Logout,
  LightMode,
  DarkMode,
} from '@mui/icons-material';

import PolicyManager from './components/PolicyManager';
import MetricsDashboard from './components/MetricsDashboard';
import RequestSimulator from './components/RequestSimulator';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

function AppContent() {
  const [selectedView, setSelectedView] = useState('policies');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, toggleTheme } = useTheme();

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const renderContent = () => {
    switch (selectedView) {
      case 'policies':
        return <PolicyManager />;
      case 'metrics':
        return <MetricsDashboard />;
      case 'simulator':
        return <RequestSimulator />;
      default:
        return <PolicyManager />;
    }
  };

  const menuItems = [
    { id: 'policies', label: 'Policy Manager', icon: <PolicyIcon /> },
    { id: 'metrics', label: 'Live Metrics', icon: <MetricsIcon /> },
    { id: 'simulator', label: 'Request Simulator', icon: <SimulatorIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
        
        {/* App Bar */}
        <AppBar
          position="fixed"
          sx={{
            width: '100%',
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: '#151515',
            borderBottom: '1px solid #333',
          }}
        >
          <Toolbar sx={{ minHeight: '64px !important' }}>
            {/* Red Hat Logo and Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
              <Box
                component="img"
                src="/redhat-fedora-logo.png"
                alt="Red Hat"
                sx={{ height: 40, mr: 2 }}
              />
              <Typography variant="h6" component="div" sx={{ color: 'white', fontWeight: 600 }}>
                MaaS
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: '#999', ml: 1 }}>
                Inference Model as a Service
              </Typography>
            </Box>
            
            <Box sx={{ flexGrow: 1 }} />
            
            {/* Navigation Tabs */}
            <Box sx={{ display: 'flex', mr: 3 }}>
              {menuItems.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => setSelectedView(item.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    mr: 2,
                    cursor: 'pointer',
                    color: selectedView === item.id ? '#fff' : '#999',
                    borderBottom: selectedView === item.id ? '2px solid #ee0000' : 'none',
                    '&:hover': {
                      color: '#fff',
                    },
                  }}
                >
                  {item.icon}
                  <Typography variant="body2">{item.label}</Typography>
                </Box>
              ))}
            </Box>
            
            {/* Theme Toggle */}
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              sx={{ mr: 2 }}
            >
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
            
            <div>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  U
                </Avatar>
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleClose}>
                  <ListItemIcon>
                    <AccountCircle fontSize="small" />
                  </ListItemIcon>
                  Profile
                </MenuItem>
                <MenuItem onClick={() => { toggleTheme(); handleClose(); }}>
                  <ListItemIcon>
                    {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
                  </ListItemIcon>
                  Switch to {mode === 'dark' ? 'Light' : 'Dark'} Mode
                </MenuItem>
                <MenuItem onClick={handleClose}>
                  <ListItemIcon>
                    <Settings fontSize="small" />
                  </ListItemIcon>
                  Settings
                </MenuItem>
                <MenuItem onClick={handleClose}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </div>
          </Toolbar>
        </AppBar>


        {/* Main content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
            pt: '80px', // Account for header only
            px: 3,
            pb: 3,
            width: '100%',
          }}
        >
          {renderContent()}
        </Box>
      </Box>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;