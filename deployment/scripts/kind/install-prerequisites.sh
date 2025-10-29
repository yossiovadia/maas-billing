#!/usr/bin/env bash

set -euo pipefail

# Prerequisites Installation Script for MaaS Local Development
# Supports Mac (Homebrew) and Linux (direct downloads)

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

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "mac"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install on Mac using Homebrew
install_mac() {
    log_info "Installing prerequisites for Mac..."

    # Check if Homebrew is installed
    if ! command_exists brew; then
        log_error "Homebrew is not installed. Please install it first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi

    # Check if Brewfile exists
    local brewfile="$SCRIPT_DIR/../../overlays/kind/Brewfile"
    if [[ ! -f "$brewfile" ]]; then
        log_error "Brewfile not found at: $brewfile"
        exit 1
    fi

    log_info "Installing tools from Brewfile..."
    brew bundle --file="$brewfile"

    # Check for Docker Desktop
    if ! command_exists docker; then
        log_warn "Docker Desktop is not installed"
        echo ""
        echo "Please install Docker Desktop manually:"
        echo "  https://www.docker.com/products/docker-desktop"
        echo ""
        echo "Or use Homebrew Cask:"
        echo "  brew install --cask docker"
        echo ""
        read -p "Press Enter after installing Docker Desktop..."
    fi

    log_success "Mac prerequisites installed successfully"
}

# Install on Linux
install_linux() {
    log_info "Installing prerequisites for Linux..."

    local arch=$(uname -m)
    local tmp_dir=$(mktemp -d)

    # Detect architecture
    if [[ "$arch" == "x86_64" ]]; then
        local arch_suffix="amd64"
    elif [[ "$arch" == "aarch64" ]] || [[ "$arch" == "arm64" ]]; then
        local arch_suffix="arm64"
    else
        log_error "Unsupported architecture: $arch"
        exit 1
    fi

    log_info "Architecture detected: $arch ($arch_suffix)"

    # Install kubectl
    if ! command_exists kubectl; then
        log_info "Installing kubectl..."
        local kubectl_version=$(curl -L -s https://dl.k8s.io/release/stable.txt)
        curl -LO "https://dl.k8s.io/release/${kubectl_version}/bin/linux/${arch_suffix}/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
        log_success "kubectl installed"
    else
        log_success "kubectl already installed"
    fi

    # Install kind
    if ! command_exists kind; then
        log_info "Installing kind..."
        local kind_version="v0.20.0"
        curl -Lo "$tmp_dir/kind" "https://kind.sigs.k8s.io/dl/${kind_version}/kind-linux-${arch_suffix}"
        chmod +x "$tmp_dir/kind"
        sudo mv "$tmp_dir/kind" /usr/local/bin/kind
        log_success "kind installed"
    else
        log_success "kind already installed"
    fi

    # Install helm
    if ! command_exists helm; then
        log_info "Installing helm..."
        curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
        log_success "helm installed"
    else
        log_success "helm already installed"
    fi

    # Install istioctl
    if ! command_exists istioctl; then
        log_info "Installing istioctl..."
        cd "$tmp_dir"
        curl -L https://istio.io/downloadIstio | sh -
        local istio_dir=$(find . -maxdepth 1 -name "istio-*" -type d | head -1)
        if [[ -n "$istio_dir" ]]; then
            sudo mv "$istio_dir/bin/istioctl" /usr/local/bin/
            log_success "istioctl installed"
        else
            log_error "Failed to install istioctl"
        fi
        cd - > /dev/null
    else
        log_success "istioctl already installed"
    fi

    # Install kustomize (optional)
    if ! command_exists kustomize; then
        log_info "Installing kustomize..."
        curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
        sudo mv kustomize /usr/local/bin/
        log_success "kustomize installed"
    else
        log_success "kustomize already installed"
    fi

    # Install jq (optional)
    if ! command_exists jq; then
        log_info "Installing jq..."
        if command_exists apt-get; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command_exists yum; then
            sudo yum install -y jq
        elif command_exists dnf; then
            sudo dnf install -y jq
        else
            log_warn "Could not install jq automatically. Please install manually."
        fi
    else
        log_success "jq already installed"
    fi

    # Check for Docker
    if ! command_exists docker; then
        log_warn "Docker is not installed"
        echo ""
        echo "Please install Docker Engine:"
        echo ""
        echo "Ubuntu/Debian:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "Fedora/RHEL:"
        echo "  sudo dnf install docker"
        echo "  sudo systemctl enable --now docker"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        read -p "Press Enter after installing Docker..."
    fi

    # Cleanup
    rm -rf "$tmp_dir"

    log_success "Linux prerequisites installed successfully"
}

# Print installed versions
print_versions() {
    echo ""
    log_info "Installed versions:"
    echo ""

    if command_exists docker; then
        echo "  Docker:     $(docker --version 2>&1 | head -1)"
    else
        echo "  Docker:     NOT INSTALLED"
    fi

    if command_exists kubectl; then
        echo "  kubectl:    $(kubectl version --client --short 2>&1 | head -1)"
    else
        echo "  kubectl:    NOT INSTALLED"
    fi

    if command_exists kind; then
        echo "  kind:       $(kind version 2>&1)"
    else
        echo "  kind:       NOT INSTALLED"
    fi

    if command_exists helm; then
        echo "  helm:       $(helm version --short 2>&1)"
    else
        echo "  helm:       NOT INSTALLED"
    fi

    if command_exists istioctl; then
        echo "  istioctl:   $(istioctl version --remote=false 2>&1 | head -1)"
    else
        echo "  istioctl:   NOT INSTALLED"
    fi

    if command_exists kustomize; then
        echo "  kustomize:  $(kustomize version --short 2>&1)"
    else
        echo "  kustomize:  (optional)"
    fi

    if command_exists jq; then
        echo "  jq:         $(jq --version 2>&1)"
    else
        echo "  jq:         (optional)"
    fi

    echo ""
}

# Main
main() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    echo "🔧 MaaS Local Development - Prerequisites Installer"
    echo ""

    local os=$(detect_os)

    case $os in
        mac)
            install_mac
            ;;
        linux)
            install_linux
            ;;
        *)
            log_error "Unsupported OS: $OSTYPE"
            exit 1
            ;;
    esac

    print_versions

    echo ""
    log_success "Prerequisites installation complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart your terminal (if Docker was just installed)"
    echo "  2. Verify Docker is running: docker ps"
    echo "  3. Run Kind setup: ./deployment/scripts/setup-kind.sh"
    echo ""
}

main "$@"
