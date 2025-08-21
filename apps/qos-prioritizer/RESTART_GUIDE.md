# 🚀 Complete Restart Guide for QoS Demo System

This guide provides step-by-step instructions to restart all components after a PC restart.

## Prerequisites
- Kubernetes cluster running (Docker Desktop, etc.)
- Node.js 18+ installed
- kubectl configured

## Step 1: Deploy LLM Model to Kubernetes

```bash
# Navigate to simulation directory
cd /Users/yovadia/code/maas-billing/apps/qos-prioritizer/simulation

# Create llm namespace if it doesn't exist
kubectl create namespace llm --dry-run=client -o yaml | kubectl apply -f -

# Deploy the stable GPT-2 Small model
kubectl apply -f simple-llm-stable.yaml

# Wait for the pod to be ready (takes 2-3 minutes)
kubectl wait --for=condition=ready pod -l app=simple-llm -n llm --timeout=300s

# Check pod status
kubectl get pods -n llm
```

## Step 2: Set Up Port Forwarding for LLM Model

```bash
# Get the pod name
export LLM_POD=$(kubectl get pods -n llm -l app=simple-llm -o jsonpath='{.items[0].metadata.name}')

# Start port forwarding (run this in a separate terminal or background)
kubectl port-forward -n llm $LLM_POD 8004:8080 &

# Test the connection
curl -s http://localhost:8004/health
```

## Step 3: Start QoS Service

```bash
# Navigate to QoS service directory
cd /Users/yovadia/code/maas-billing/apps/qos-prioritizer

# Install dependencies (if not already done)
npm install

# Start the QoS service (run in separate terminal or background)
npm run dev &

# Test the service
curl -s http://localhost:3001/health
```

## Step 4: Optional - Start Full MaaS Platform

If you want to run the complete platform:

```bash
# Start backend (in separate terminal)
cd /Users/yovadia/code/maas-billing/apps/backend
npm run dev &

# Start frontend (in separate terminal)  
cd /Users/yovadia/code/maas-billing/apps/frontend
npm start &
```

## Step 5: Run the Demo

```bash
# Navigate to simulation directory
cd /Users/yovadia/code/maas-billing/apps/qos-prioritizer/simulation

# Run the unified demo
./demo.sh

# Choose option 1 for "without QoS" or option 2 for "with QoS"
```

## Quick Validation Commands

```bash
# Check all components are running
kubectl get pods -n llm                           # LLM model pod
curl -s http://localhost:8004/health              # LLM health check
curl -s http://localhost:3001/health              # QoS service health

# If any port-forward is broken, restart it:
kubectl port-forward -n llm $(kubectl get pods -n llm -l app=simple-llm -o jsonpath='{.items[0].metadata.name}') 8004:8080
```

## Troubleshooting

### LLM Pod Issues
```bash
# Check pod logs
kubectl logs -n llm -l app=simple-llm

# If pod is CrashLooping, delete and recreate
kubectl delete -f simple-llm-stable.yaml
kubectl apply -f simple-llm-stable.yaml
```

### Port Forward Issues
```bash
# Kill existing port forwards
pkill -f "kubectl port-forward"

# Restart port forward
kubectl port-forward -n llm $(kubectl get pods -n llm -l app=simple-llm -o jsonpath='{.items[0].metadata.name}') 8004:8080
```

### QoS Service Issues
```bash
# Check if port 3001 is in use
lsof -i :3001

# Restart QoS service
cd /Users/yovadia/code/maas-billing/apps/qos-prioritizer
npm run dev
```

## Expected Results

When everything is working correctly:

**Without QoS (Option 1):**
- All customers served first-come-first-serve
- Enterprise customers may finish after Free users

**With QoS (Option 2):**  
- Enterprise customers should complete in positions 1-2
- Free users should complete in positions 3-5
- Clear priority demonstration

## Architecture Summary

```
Demo Request → QoS Service (port 3001) → GPT-2 Small (port 8004) → Kubernetes Pod
             ↓
       Priority Queue Management
       - Enterprise: 3 concurrent slots
       - Premium: 2 concurrent slots  
       - Free: 1 concurrent slot
```

## Model Details
- **Model**: GPT-2 Small (124M parameters)
- **Response Time**: 3-5 seconds
- **Stability**: Optimized for Apple M4 MacBook
- **Resources**: 768Mi memory, 300m CPU