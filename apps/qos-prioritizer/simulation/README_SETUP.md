# QoS Demo Setup Guide

## Quick Start

1. **Prepare Environment** (one-time setup):
   ```bash
   ./prepare_env.sh
   ```
   This will:
   - Validate prerequisites (kubectl, node, npm, curl)
   - Deploy/validate LLM pod in Kubernetes
   - Set up port forwarding (8004 → LLM)
   - Start QoS service (port 3005)
   - Start backend service (port 3001)
   - Start frontend UI (port 3000)

2. **Run Demos**:
   ```bash
   ./demo.sh
   ```
   Choose from:
   - Option 1: Without QoS (shows the problem)
   - Option 2: With QoS (shows the solution)
   - Option 3: Advanced 3-tier QoS (full demo)

## Service Ports

- **8004**: LLM model (port-forwarded from Kubernetes)
- **3005**: QoS prioritizer service
- **3001**: Backend service (MaaS platform API)
- **3000**: Frontend UI (real-time graphs & monitoring)

## Monitoring

- **Real-time graphs**: Open http://localhost:3000 → QoS tab
- **QoS logs**: Check terminal where prepare_env.sh was run
- **LLM logs**: `kubectl logs -n llm -f <pod-name>`

## Cleanup

```bash
# Stop all services
pkill -f 'kubectl port-forward'  # Stop port forwards
pkill -f 'npm run dev'          # Stop QoS + Backend services  
pkill -f 'npm start'            # Stop frontend
```

## Troubleshooting

If demos fail, re-run the environment setup:
```bash
./prepare_env.sh
```

The setup script will:
- Check and fix any broken services
- Restart failed port forwards
- Validate all connections before proceeding