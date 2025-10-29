# Local Development with Kind

This directory contains configuration for running MaaS locally using [Kubernetes in Docker (Kind)](https://kind.sigs.k8s.io/).

> **Status**: 🚧 Work in Progress
>
> This is an active development effort to enable cross-platform local development.
> See [PRD.md](PRD.md) for the complete plan.

## Quick Start

```bash
# 1. Prerequisites check
./deployment/scripts/setup-kind.sh --check

# 2. Create Kind cluster and deploy MaaS
./deployment/scripts/setup-kind.sh

# 3. Verify deployment
./deployment/scripts/validate-kind.sh
```

## Prerequisites

### Required Software
- **Docker Desktop** (Mac) or **Docker Engine** (Linux)
  - Mac: Docker Desktop 4.0+ with 8GB RAM allocated
  - Linux: Docker Engine 20.10+
- **kubectl** 1.28+
- **kind** 0.20+
- **istioctl** 1.20+
- **helm** 3.12+

### Installation

#### Mac (Homebrew)
```bash
brew install kubectl kind istioctl helm
```

#### Linux (Ubuntu/Debian)
```bash
# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/kubectl

# kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

# istioctl
curl -L https://istio.io/downloadIstio | sh -
sudo mv istio-*/bin/istioctl /usr/local/bin/

# helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### System Requirements
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 20GB free space
- **CPU**: 4 cores recommended

## Manual Setup (Step-by-Step)

If you prefer manual setup or want to understand what the script does:

### 1. Create Kind Cluster
```bash
kind create cluster --config deployment/overlays/kind/kind-config.yaml --name maas-local
```

### 2. Install Gateway API CRDs
```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
```

### 3. Install Dependencies
```bash
cd deployment/scripts
./install-dependencies.sh --cert-manager --kserve --kuadrant --prometheus
```

### 4. Install Istio
```bash
istioctl install --set profile=demo -y
```

### 5. Deploy MaaS Components
```bash
kubectl apply -k deployment/overlays/kind/
```

### 6. Wait for Components to be Ready
```bash
kubectl wait --for=condition=Available deployment/maas-api -n maas-api --timeout=300s
kubectl wait --for=condition=Available deployment/kuadrant-operator-controller-manager -n kuadrant-system --timeout=300s
```

## Accessing the Platform

### Gateway Endpoints
```bash
# Get the gateway address
kubectl get gateway maas-gateway -n maas-api

# Access via localhost (port mappings configured in Kind)
http://localhost/maas-api/v1/models
```

### Frontend/Backend Development
```bash
# Start local development servers
cd apps
./scripts/start-dev.sh

# Access:
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

## Testing

### Test Model Inference
```bash
# Deploy simulator model
kubectl apply -k docs/samples/models/simulator/

# Wait for model to be ready
kubectl wait --for=condition=Ready pod -l serving.kserve.io/inferenceservice=simulator -n llm --timeout=300s

# Get auth token
TOKEN=$(kubectl create token default -n maas-api)

# Test inference
curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "simulator", "prompt": "Hello", "max_tokens": 50}' \
  http://localhost/v1/models/llm.simulator/infer
```

### Test Policy Enforcement
```bash
# Test without token (should fail with 401)
curl -v http://localhost/maas-api/v1/models

# Test with token (should succeed)
TOKEN=$(kubectl create token default -n maas-api)
curl -H "Authorization: Bearer $TOKEN" http://localhost/maas-api/v1/models
```

## Troubleshooting

### Cluster Creation Fails
```bash
# Check Docker is running
docker ps

# Check Docker resources (Mac)
# Docker Desktop → Preferences → Resources
# Ensure at least 8GB RAM allocated

# Clean up and retry
kind delete cluster --name maas-local
kind create cluster --config deployment/overlays/kind/kind-config.yaml --name maas-local
```

### Pods Not Starting
```bash
# Check pod status
kubectl get pods -A

# Check specific pod logs
kubectl logs -n <namespace> <pod-name>

# Common issue: Insufficient resources
docker stats  # Check Docker resource usage
```

### Gateway Not Accessible
```bash
# Verify port mappings
docker ps | grep maas-local-control-plane

# Should show:
# 0.0.0.0:80->80/tcp
# 0.0.0.0:443->443/tcp

# Test connectivity
curl -v http://localhost/
```

### Kuadrant Installation Issues
```bash
# Check if OLM is causing conflicts (shouldn't exist on Kind)
kubectl get csv -A

# Reinstall Kuadrant via Helm
helm repo add kuadrant https://kuadrant.io/helm-charts/
helm upgrade --install kuadrant-operator kuadrant/kuadrant-operator \
  -n kuadrant-system --create-namespace
```

## Cleanup

```bash
# Delete Kind cluster (removes everything)
kind delete cluster --name maas-local

# Or use cleanup script
./deployment/scripts/cleanup-kind.sh
```

## Known Limitations

- **GPU Models**: GPU passthrough limited on Docker Desktop (Mac). Only CPU models supported.
- **Performance**: Slower than native Kubernetes on Linux due to Docker Desktop VM on Mac
- **Multi-node**: Single-node cluster only (sufficient for development)
- **LoadBalancer**: Uses port mappings instead of real LoadBalancer

## Differences from OpenShift Deployment

| Feature | OpenShift | Kind |
|---------|-----------|------|
| Gateway Controller | OpenShift Gateway API | Istio |
| Routes | OpenShift Routes | HTTPRoutes (Gateway API) |
| Kuadrant | OLM Subscription | Helm Chart |
| LoadBalancer | OpenShift Router | Port Mappings |
| Auth | OpenShift OAuth | ServiceAccount Tokens |

## Contributing

See [PRD.md](PRD.md) for the development plan and how to contribute.

## Support

For issues or questions:
- GitHub Issues: https://github.com/opendatahub-io/maas-billing/issues
- Tag with `kind` label
