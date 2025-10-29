#!/usr/bin/env bash

set -euo pipefail

# MaaS Local Development Setup with Kind
# Supports Mac (Intel/ARM) and Linux (x86_64/ARM64)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KIND_CONFIG="$PROJECT_ROOT/deployment/overlays/kind/kind-config.yaml"
CLUSTER_NAME="maas-local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    # Required tools
    if ! command_exists docker; then
        missing_tools+=("docker")
    fi

    if ! command_exists kubectl; then
        missing_tools+=("kubectl")
    fi

    if ! command_exists kind; then
        missing_tools+=("kind")
    fi

    if ! command_exists istioctl; then
        missing_tools+=("istioctl")
    fi

    if ! command_exists helm; then
        missing_tools+=("helm")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        echo ""
        echo "Install instructions:"
        echo ""
        echo "Mac (Homebrew):"
        echo "  brew install kubectl kind istioctl helm"
        echo ""
        echo "Linux:"
        echo "  See deployment/overlays/kind/README.md for installation instructions"
        echo ""
        exit 1
    fi

    # Check Docker is running
    if ! docker ps >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop (Mac) or Docker Engine (Linux)"
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

# Create Kind cluster
create_cluster() {
    log_info "Creating Kind cluster '$CLUSTER_NAME'..."

    # Check if cluster already exists
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_warn "Cluster '$CLUSTER_NAME' already exists"
        read -p "Delete and recreate? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deleting existing cluster..."
            kind delete cluster --name "$CLUSTER_NAME"
        else
            log_info "Using existing cluster"
            return 0
        fi
    fi

    # Create cluster
    if ! kind create cluster --config "$KIND_CONFIG" --name "$CLUSTER_NAME"; then
        log_error "Failed to create Kind cluster"
        exit 1
    fi

    # Set kubectl context
    kubectl config use-context "kind-${CLUSTER_NAME}"

    log_success "Kind cluster created successfully"
}

# Install Gateway API CRDs
install_gateway_api() {
    log_info "Installing Gateway API CRDs..."

    local gateway_api_version="v1.2.1"
    kubectl apply -f "https://github.com/kubernetes-sigs/gateway-api/releases/download/${gateway_api_version}/standard-install.yaml"

    log_success "Gateway API CRDs installed"
}

# Install cert-manager
install_cert_manager() {
    log_info "Installing cert-manager..."

    local cert_manager_version="v1.19.1"
    kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${cert_manager_version}/cert-manager.yaml"

    # Wait for cert-manager to be ready
    log_info "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s
    kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s
    kubectl wait --for=condition=Available deployment/cert-manager-cainjector -n cert-manager --timeout=300s

    log_success "cert-manager installed"
}

# Install Istio
install_istio() {
    log_info "Installing Istio..."

    # Install with demo profile (includes Gateway API support)
    istioctl install --set profile=demo -y

    # Wait for Istio to be ready
    log_info "Waiting for Istio to be ready..."
    kubectl wait --for=condition=Available deployment/istiod -n istio-system --timeout=300s
    kubectl wait --for=condition=Available deployment/istio-ingressgateway -n istio-system --timeout=300s

    log_success "Istio installed"
}

# Install Kuadrant via Helm
install_kuadrant() {
    log_info "Installing Kuadrant..."

    # Create namespace
    kubectl create namespace kuadrant-system --dry-run=client -o yaml | kubectl apply -f -

    # Add Helm repo
    helm repo add kuadrant https://kuadrant.io/helm-charts/ 2>/dev/null || true
    helm repo update

    # Install Kuadrant operator
    helm upgrade --install kuadrant-operator kuadrant/kuadrant-operator \
        -n kuadrant-system \
        --create-namespace \
        --wait \
        --timeout 5m

    log_success "Kuadrant installed"
}

# Install KServe
install_kserve() {
    log_info "Installing KServe..."

    local kserve_version="v0.11.0"
    kubectl apply -f "https://github.com/kserve/kserve/releases/download/${kserve_version}/kserve.yaml"

    # Wait for KServe controller
    log_info "Waiting for KServe to be ready..."
    kubectl wait --for=condition=Available deployment/kserve-controller-manager -n kserve --timeout=300s

    log_success "KServe installed"
}

# Deploy MaaS components
deploy_maas() {
    log_info "Deploying MaaS components..."

    # Apply Kustomize overlay
    kubectl apply -k "$PROJECT_ROOT/deployment/overlays/kind/"

    # Wait for MaaS API to be ready
    log_info "Waiting for MaaS API to be ready..."
    kubectl wait --for=condition=Available deployment/maas-api -n maas-api --timeout=300s || true

    log_success "MaaS components deployed"
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."

    # Check all pods are running
    log_info "Checking pod status..."
    kubectl get pods -A

    # Check gateway status
    log_info "Checking gateway status..."
    kubectl get gateway -A

    # Check policies
    log_info "Checking policies..."
    kubectl get authpolicy -A
    kubectl get ratelimitpolicy -A || true

    log_success "Deployment validation complete"
}

# Print access information
print_access_info() {
    echo ""
    log_success "MaaS local environment is ready!"
    echo ""
    echo "Access Information:"
    echo "  Gateway:     http://localhost/"
    echo "  MaaS API:    http://localhost/maas-api/v1/"
    echo "  Health:      http://localhost/health"
    echo ""
    echo "Get Auth Token:"
    echo "  kubectl create token default -n maas-api"
    echo ""
    echo "Test Model List:"
    echo "  TOKEN=\$(kubectl create token default -n maas-api)"
    echo "  curl -H \"Authorization: Bearer \$TOKEN\" http://localhost/maas-api/v1/models"
    echo ""
    echo "Deploy Sample Model:"
    echo "  kubectl apply -k docs/samples/models/simulator/"
    echo ""
    echo "Start Frontend/Backend:"
    echo "  cd apps && ./scripts/start-dev.sh"
    echo ""
    echo "Cleanup:"
    echo "  kind delete cluster --name $CLUSTER_NAME"
    echo ""
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --check          Check prerequisites only"
    echo "  --cluster-only   Create cluster only (skip component installation)"
    echo "  --skip-maas      Skip MaaS deployment (infrastructure only)"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Full setup"
    echo "  $0 --check              # Check prerequisites"
    echo "  $0 --cluster-only       # Create cluster only"
    echo ""
}

# Main execution
main() {
    local check_only=false
    local cluster_only=false
    local skip_maas=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --check)
                check_only=true
                shift
                ;;
            --cluster-only)
                cluster_only=true
                shift
                ;;
            --skip-maas)
                skip_maas=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    echo "🚀 MaaS Local Development Setup"
    echo ""

    # Check prerequisites
    check_prerequisites

    if [ "$check_only" = true ]; then
        exit 0
    fi

    # Create cluster
    create_cluster

    if [ "$cluster_only" = true ]; then
        log_success "Cluster created. Use kubectl to interact with it."
        exit 0
    fi

    # Install components
    install_gateway_api
    install_cert_manager
    install_istio
    install_kuadrant
    install_kserve

    if [ "$skip_maas" = false ]; then
        deploy_maas
    fi

    # Validate
    validate_deployment

    # Print access info
    print_access_info
}

# Run main function
main "$@"
