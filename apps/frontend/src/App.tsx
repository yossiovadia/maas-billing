import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Avatar,
  useTheme,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import {
  Policy as PolicyIcon,
  BarChart as MetricsIcon,
  PlayArrow as SimulatorIcon,
  AccountCircle,
  Settings,
  Logout,
} from '@mui/icons-material';

import PolicyManager from './components/PolicyManager';
import MetricsDashboard from './components/MetricsDashboard';
import RequestSimulator from './components/RequestSimulator';

const drawerWidth = 240;

// Create dark theme similar to original
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ee0000', // Red Hat red
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
  },
});

function App() {
  const [selectedView, setSelectedView] = useState('policies');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        
        {/* App Bar */}
        <AppBar
          position="fixed"
          sx={{
            width: `calc(100% - ${drawerWidth}px)`,
            ml: `${drawerWidth}px`,
          }}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              MaaS - Models as a Service
            </Typography>
            
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

        {/* Drawer */}
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                component="img"
                sx={{ height: 32, width: 32 }}
                alt="Red Hat Logo"
                src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMzAwIj48cGF0aCBkPSJNMTUwIDI3MEMyMjguMjQgMjcwIDI5MCAyMDguMjQgMjkwIDEzMFM2OS43NiAyOS43NiAwIDEwMGMwIDcwLjI0IDU5Ljc2IDEzMCAxMzAgMTMwczEzMCA1OS43NiAxMzAgMTMweiIgZmlsbD0iI2VlMDAwMCIvPjwvc3ZnPg=="
              />
              <Typography variant="h6" component="div" color="primary.main">
                Red Hat
              </Typography>
            </Box>
          </Toolbar>

          <List>
            {menuItems.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  selected={selectedView === item.id}
                  onClick={() => setSelectedView(item.id)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Main content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
            p: 3,
            width: `calc(100% - ${drawerWidth}px)`,
          }}
        >
          <Toolbar />
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;