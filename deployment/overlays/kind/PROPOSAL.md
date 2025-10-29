# Proposal: Cross-Platform Local Development with Kind

## TL;DR

I've created a **Kind-based local development setup** for MaaS that works on **Mac (M4/Intel) and Linux (x86_64/ARM64)**. This allows contributors to run the full MaaS stack locally without needing an OpenShift cluster.

**Branch**: `feature/kind-local-development`

## 🎯 Problem

Currently, MaaS development requires:
- Access to an OpenShift cluster (4.19.9+)
- Complex infrastructure setup
- Internet connectivity for cluster access
- No easy way to test changes locally

This creates barriers for new contributors and slows down development cycles.

## ✅ Solution

A cross-platform local development environment using:
- **Kind** (Kubernetes in Docker) - lightweight, production-like K8s
- **Istio** - Gateway API controller (replaces OpenShift Gateway)
- **Helm** - Kuadrant installation (replaces OLM)
- **Gateway API** - HTTPRoutes (replaces OpenShift Routes)

## 📁 What's Included

```
deployment/overlays/kind/
├── PRD.md                    # Complete implementation plan
├── README.md                 # Setup and usage guide
├── kind-config.yaml          # Kind cluster configuration
├── kustomization.yaml        # Kustomize overlay (inherits base/)
├── gateway-class.yaml        # Istio GatewayClass
└── httproutes.yaml          # Gateway API HTTPRoutes

deployment/scripts/
├── setup-kind.sh            # Automated setup (one command)
└── cleanup-kind.sh          # Cleanup script
```

## 🚀 Quick Start

```bash
# Check prerequisites
./deployment/scripts/kind/setup-kind.sh --check

# Full setup (< 15 minutes)
./deployment/scripts/kind/setup-kind.sh

# Cleanup
./deployment/scripts/kind/cleanup-kind.sh
```

## 🏗️ Architecture

The setup:
1. **Reuses `deployment/base/`** - no duplication
2. **Patches only what's different** - Gateway class, Routes → HTTPRoutes
3. **Follows existing patterns** - same structure as `overlays/openshift/`
4. **Cross-platform** - identical experience on Mac and Linux

### Key Differences from OpenShift

| Component | OpenShift | Kind |
|-----------|-----------|------|
| Gateway Controller | OpenShift Gateway API | Istio |
| Routes | OpenShift Routes | HTTPRoutes |
| Kuadrant | OLM Subscription | Helm Chart |
| LoadBalancer | OpenShift Router | Port Mappings |
| Auth | OpenShift OAuth | ServiceAccount Tokens |

## ✨ Benefits

### For Contributors
- ✅ No OpenShift cluster needed
- ✅ Work offline
- ✅ Faster development cycles
- ✅ Easy to test changes locally

### For the Project
- ✅ Lower barrier to entry
- ✅ More contributors
- ✅ Better CI/CD testing
- ✅ Cross-platform support

### For Maintainers
- ✅ Reuses existing `base/` manifests
- ✅ Minimal maintenance overhead
- ✅ Clear separation (overlays pattern)
- ✅ Well-documented

## 📋 Implementation Status

**Current State**: ✅ Initial implementation complete
- [x] PRD and architecture design
- [x] Kind cluster configuration
- [x] Kustomize overlay structure
- [x] Setup/cleanup scripts
- [x] Documentation

**Next Steps** (pending approval):
1. Test on multiple platforms (Mac M4 ✅, Mac Intel, Linux x86_64, Linux ARM64)
2. Fix any issues found during testing
3. Add validation script
4. Update main README with Kind option
5. Create PR for review

## 🧪 Testing Plan

### Platforms to Test
- [x] Mac M4 (Apple Silicon)
- [ ] Mac Intel (x86_64)
- [ ] Linux x86_64 (Ubuntu 22.04)
- [ ] Linux ARM64 (if available)

### Test Scenarios
- [ ] Full setup from scratch
- [ ] MaaS API deployment
- [ ] Model deployment (simulator)
- [ ] Policy enforcement (AuthPolicy, RateLimitPolicy)
- [ ] Frontend/Backend integration
- [ ] Cleanup and re-setup

## 📊 Estimated Effort

| Phase | Effort | Status |
|-------|--------|--------|
| **Phase 1**: Infrastructure setup | 1 week | ✅ Done |
| **Phase 2**: Component patches | 1 week | 🔄 In progress |
| **Phase 3**: Model deployment | 1 week | ⏳ Pending |
| **Phase 4**: Testing & docs | 1 week | ⏳ Pending |

**Total**: ~4 weeks to production-ready

## ⚠️ Known Limitations

1. **GPU Models**: Limited GPU passthrough on Mac (CPU models only)
2. **Performance**: Slightly slower than native K8s on Linux (Docker Desktop VM overhead on Mac)
3. **Multi-node**: Single-node cluster (sufficient for development)
4. **ODH Components**: Not available (OpenShift-only)

## 💭 Open Questions

1. **Should we support multiple profiles?** (minimal, full, GPU)
2. **Include Prometheus/Grafana?** (or keep optional)
3. **Pre-load model images?** (faster startup but larger initial download)
4. **Alternative for frontend-only development?** (Docker Compose for just apps)

## 🙏 Feedback Requested

- [ ] **Architecture**: Does the approach make sense?
- [ ] **Structure**: Is `deployment/overlays/kind/` the right place?
- [ ] **Scope**: Is this useful for the project?
- [ ] **Priorities**: What should be tackled first?

## 🔗 References

- **PRD**: [deployment/overlays/kind/PRD.md](PRD.md) - Full implementation plan
- **Setup Guide**: [deployment/overlays/kind/README.md](README.md) - Usage instructions
- **Branch**: `feature/kind-local-development`

## 📞 Next Steps

1. **Review this proposal** - Does it align with project goals?
2. **Test the setup** - Does it work as expected?
3. **Provide feedback** - What needs to change?
4. **Approve or iterate** - Should we move forward?

---

**Looking forward to your feedback!** 🚀

This could make MaaS development much more accessible to contributors worldwide.
