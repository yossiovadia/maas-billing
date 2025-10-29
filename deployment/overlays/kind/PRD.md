# PRD: Local Development Environment with Kind

## Overview
Enable cross-platform local development for the MaaS (Models as a Service) platform using Kubernetes in Docker (Kind), supporting both Mac (Apple Silicon/Intel) and Linux (x86_64/ARM64) development environments.

## Problem Statement
Currently, the MaaS project requires:
- Access to an OpenShift cluster (4.19.9+)
- Complex infrastructure setup (KServe, Kuadrant, Istio, Gateway API)
- No straightforward local development option for contributors

This creates barriers for:
- New contributors getting started
- Rapid development and testing cycles
- Offline development
- CI/CD testing

## Goals

### Primary Goals
1. **Cross-Platform Support**: Identical setup experience on Mac M4, Mac Intel, Linux x86_64, and Linux ARM64
2. **Full Stack Local**: Run complete MaaS infrastructure locally (Gateway API, Istio, KServe, Kuadrant, MaaS API)
3. **Developer Friendly**: Simple setup (< 15 minutes from zero to working environment)
4. **Maintainable**: Reuse existing `deployment/base/` manifests with minimal Kind-specific patches

### Secondary Goals
1. **Documentation**: Comprehensive guide for local development
2. **CI/CD Ready**: Enable automated testing in GitHub Actions
3. **Resource Efficient**: Run on laptops with 8GB+ RAM

### Non-Goals
1. Production deployment (OpenShift remains the production target)
2. GPU model inference (limited by Docker Desktop on Mac)
3. Multi-node clusters (single-node Kind sufficient for development)
4. High availability features

## Success Criteria
- [ ] Developer can set up full MaaS stack locally in < 15 minutes
- [ ] All MaaS components deploy successfully (maas-api, policies, models)
- [ ] Frontend/backend development workflow works
- [ ] Policy testing works (AuthPolicy, RateLimitPolicy)
- [ ] Model inference works (CPU models like simulator, facebook-opt-125m)
- [ ] Works identically on Mac M4 and Linux x86_64
- [ ] Documentation is clear and complete

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────┐
│           Developer Machine (Mac/Linux)         │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │       Docker Desktop / Docker Engine      │ │
│  │                                           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │      Kind Cluster (maas-local)      │ │ │
│  │  │                                     │ │ │
│  │  │  ┌──────────────────────────────┐  │ │ │
│  │  │  │   Gateway API Controller      │  │ │ │
│  │  │  │   (Istio)                     │  │ │ │
│  │  │  └──────────────────────────────┘  │ │ │
│  │  │  ┌──────────────────────────────┐  │ │ │
│  │  │  │   Kuadrant Operators          │  │ │ │
│  │  │  │   - Authorino (AuthN/AuthZ)   │  │ │ │
│  │  │  │   - Limitador (Rate Limiting) │  │ │ │
│  │  │  └──────────────────────────────┘  │ │ │
│  │  │  ┌──────────────────────────────┐  │ │ │
│  │  │  │   KServe (RawDeployment)      │  │ │ │
│  │  │  └──────────────────────────────┘  │ │ │
│  │  │  ┌──────────────────────────────┐  │ │ │
│  │  │  │   MaaS API Service            │  │ │ │
│  │  │  └──────────────────────────────┘  │ │ │
│  │  │  ┌──────────────────────────────┐  │ │ │
│  │  │  │   Model Pods (CPU)            │  │ │ │
│  │  │  │   - Simulator                 │  │ │ │
│  │  │  │   - facebook-opt-125m         │  │ │ │
│  │  │  └──────────────────────────────┘  │ │ │
│  │  └─────────────────────────────────┘  │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Localhost Access:                          │
│  - http://localhost:80 → Gateway            │
│  - http://localhost:443 → Gateway (TLS)     │
│  - http://localhost:3000 → Frontend         │
│  - http://localhost:3001 → Backend          │
└─────────────────────────────────────────────┘
```

### Components

#### 1. Kind Cluster Configuration
**File**: `deployment/overlays/kind/kind-config.yaml`
- Single control-plane node
- Port mappings: 80, 443 (for Gateway access)
- Node labels for ingress readiness
- Resource limits: 8GB RAM, 4 CPUs (configurable)

#### 2. Kustomize Overlay
**File**: `deployment/overlays/kind/kustomization.yaml`
- Inherits from `deployment/base/`
- Patches for Kind-specific differences:
  - Gateway class (Istio instead of OpenShift)
  - Service types (NodePort with port mappings instead of Routes)
  - Kuadrant installation (Helm-based instead of OLM)

#### 3. Setup Script
**File**: `deployment/scripts/setup-kind.sh`
- Prerequisites check (Docker, kubectl, kind, istioctl, helm)
- Kind cluster creation with config
- Dependency installation (Gateway API, cert-manager, Istio, Kuadrant, KServe)
- MaaS deployment via Kustomize
- Validation and health checks
- Output: URLs and access instructions

#### 4. Documentation
**File**: `deployment/overlays/kind/README.md`
- Prerequisites and installation
- Step-by-step setup guide
- Common issues and troubleshooting
- Development workflow
- Testing guide

### Key Differences from OpenShift

| Component | OpenShift | Kind |
|-----------|-----------|------|
| **Gateway Controller** | OpenShift Gateway API | Istio Gateway Controller |
| **Routes** | OpenShift Routes | Gateway API HTTPRoutes |
| **Kuadrant Install** | OLM Subscription | Helm Chart |
| **LoadBalancer** | OpenShift Router | Kind port mappings |
| **Service Mesh** | Red Hat Service Mesh | Istio (upstream) |
| **KServe** | ODH/RHOAI managed | Standalone (RawDeployment) |
| **TLS/Certs** | OpenShift cert manager | cert-manager |
| **Auth** | OpenShift OAuth | Kubernetes ServiceAccount tokens |

### Implementation Plan

#### Phase 1: Infrastructure Setup (Week 1)
- [ ] Create `deployment/overlays/kind/` directory structure
- [ ] Write Kind cluster configuration
- [ ] Create base Kustomize overlay inheriting from `base/`
- [ ] Write setup script for automated installation
- [ ] Test on Mac M4 and Linux x86_64

**Deliverables:**
- `deployment/overlays/kind/kind-config.yaml`
- `deployment/overlays/kind/kustomization.yaml`
- `deployment/scripts/setup-kind.sh`
- `deployment/scripts/cleanup-kind.sh`

#### Phase 2: Component Patches (Week 2)
- [ ] Gateway API patches (Istio GatewayClass)
- [ ] HTTPRoute conversions (replace OpenShift Routes)
- [ ] Kuadrant Helm installation patches
- [ ] KServe configuration (RawDeployment mode)
- [ ] MaaS API deployment patches (if needed)

**Deliverables:**
- `deployment/overlays/kind/patches/gateway-class.yaml`
- `deployment/overlays/kind/patches/httproutes.yaml`
- `deployment/overlays/kind/patches/kuadrant-helm.yaml`

#### Phase 3: Model Deployment (Week 3)
- [ ] Adapt simulator model for Kind
- [ ] Adapt facebook-opt-125m model for Kind
- [ ] Verify model inference endpoints
- [ ] Test policy enforcement (auth, rate limiting)

**Deliverables:**
- `docs/samples/models/simulator/kind-overlay/` (if needed)
- Validation test scripts

#### Phase 4: Documentation & Testing (Week 4)
- [ ] Write comprehensive README
- [ ] Add troubleshooting guide
- [ ] Create quick-start video/GIF (optional)
- [ ] Test on all platforms (Mac M4, Mac Intel, Linux x86_64, Linux ARM64)
- [ ] Document known limitations

**Deliverables:**
- `deployment/overlays/kind/README.md`
- `docs/content/local-development.md`
- Platform test reports

## File Structure

```
deployment/
├── base/                          # Existing - no changes
├── components/                    # Existing - no changes
├── overlays/
│   ├── openshift/                # Existing
│   └── kind/                     # NEW
│       ├── README.md             # Kind-specific documentation
│       ├── PRD.md                # This file
│       ├── kind-config.yaml      # Kind cluster configuration
│       ├── kustomization.yaml    # Main overlay (inherits base/)
│       ├── gateway-class.yaml    # Istio GatewayClass
│       ├── httproutes.yaml       # Gateway API HTTPRoutes
│       └── patches/              # Kind-specific patches
│           ├── gateway-patch.yaml
│           ├── maas-api-patch.yaml
│           └── kuadrant-config.yaml
└── scripts/
    ├── setup-kind.sh             # NEW - Automated Kind setup
    ├── cleanup-kind.sh           # NEW - Cluster cleanup
    └── validate-kind.sh          # NEW - Post-deployment validation
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
- **kustomize** 5.0+ (or kubectl built-in)

### System Requirements
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 20GB free space
- **CPU**: 4 cores recommended
- **OS**: macOS 12+ (Intel/ARM) or Linux kernel 5.0+

## Testing Strategy

### Unit Testing
- Each script has dry-run mode
- Validation functions for each component
- Cleanup verification

### Integration Testing
- Full deployment test on Mac M4
- Full deployment test on Linux x86_64
- Verify all MaaS components healthy
- Verify model inference works
- Verify policy enforcement works

### Platform Coverage
- [x] Mac M4 (Apple Silicon)
- [ ] Mac Intel (x86_64)
- [ ] Linux x86_64 (Ubuntu 22.04)
- [ ] Linux ARM64 (if available)

## Known Limitations

1. **GPU Models**: GPU passthrough limited on Docker Desktop (Mac). Only CPU models supported.
2. **Performance**: Slower than native Kubernetes on Linux (due to Docker Desktop VM on Mac)
3. **Multi-node**: Single-node only (sufficient for development, not production testing)
4. **ODH Components**: OpenDataHub-specific features not available (OpenShift-only)
5. **Observability**: Grafana operator not available (can use Helm chart alternative)

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Docker Desktop resource limits | Medium | High | Document RAM/CPU requirements, provide optimization tips |
| Kuadrant Helm chart differences from OLM | Medium | Medium | Thorough testing, document differences |
| Gateway API version compatibility | High | Low | Pin to tested versions, document upgrade path |
| Platform-specific issues | Medium | Medium | Test on all platforms, maintain compatibility matrix |
| Maintenance burden | Low | High | Automate testing, reuse base/ manifests |

## Success Metrics

### Quantitative
- Setup time: < 15 minutes (automated)
- Memory usage: < 8GB RAM
- Disk usage: < 15GB
- Success rate: > 95% on supported platforms

### Qualitative
- Developer feedback: Positive ease-of-use
- Contribution increase: More PRs from new contributors
- Issue reduction: Fewer "can't test locally" issues

## Timeline

- **Week 1**: Infrastructure setup and basic Kind deployment
- **Week 2**: Component patches and Kustomize overlay
- **Week 3**: Model deployment and policy testing
- **Week 4**: Documentation, testing, and refinement

**Target Completion**: 4 weeks from start

## Open Questions

1. Should we support multiple Kind cluster profiles (minimal, full, GPU)?
2. Should we include Prometheus/Grafana in the Kind setup or keep it optional?
3. Should we pre-load commonly used model images to reduce startup time?
4. Should we create a Docker Compose alternative for frontend/backend-only development?

## Approval & Sign-off

- [ ] Technical Review: @bartoszmajsak @israel-hdez
- [ ] Architecture Review: @nerdalert @chaitanya1731
- [ ] Documentation Review: @jland-redhat
- [ ] Final Approval: MaaS Team

## Updates Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-29 | @yossiovadia | Initial PRD creation |

---

## References
- [Kind Documentation](https://kind.sigs.k8s.io/)
- [Gateway API Documentation](https://gateway-api.sigs.k8s.io/)
- [Kuadrant Helm Charts](https://docs.kuadrant.io/)
- [MaaS Deployment Guide](../README.md)
