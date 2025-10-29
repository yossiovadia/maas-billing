#!/usr/bin/env bash

set -euo pipefail

# MaaS Local Development Cleanup Script
# Removes the Kind cluster and related resources

CLUSTER_NAME="maas-local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️ ${NC}$1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# Main cleanup
main() {
    echo "🧹 MaaS Local Development Cleanup"
    echo ""

    # Check if cluster exists
    if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_warn "Cluster '$CLUSTER_NAME' does not exist"
        exit 0
    fi

    # Confirm deletion
    log_warn "This will delete the Kind cluster '$CLUSTER_NAME' and all resources"
    read -p "Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi

    # Delete cluster
    log_info "Deleting Kind cluster..."
    if kind delete cluster --name "$CLUSTER_NAME"; then
        log_success "Cluster deleted successfully"
    else
        log_error "Failed to delete cluster"
        exit 1
    fi

    # Optional: Clean up Docker images
    read -p "Remove unused Docker images? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up Docker images..."
        docker system prune -f
        log_success "Docker cleanup complete"
    fi

    echo ""
    log_success "Cleanup complete!"
}

main "$@"
