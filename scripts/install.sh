#!/usr/bin/env bash
set -euo pipefail

# AI Report to Me — one-click installer
# Usage: curl -fsSL https://raw.githubusercontent.com/FakeHank/ai-report-to-me/main/scripts/install.sh | bash

PACKAGE="ai-report-to-me"
MIN_NODE_VERSION=20

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BOLD}$*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✗ $*${NC}" >&2; }

check_node() {
  if ! command -v node &>/dev/null; then
    error "Node.js is not installed."
    info "Install Node.js ${MIN_NODE_VERSION}+ from https://nodejs.org"
    exit 1
  fi

  local version
  version=$(node -v | sed 's/^v//' | cut -d. -f1)
  if [ "$version" -lt "$MIN_NODE_VERSION" ]; then
    error "Node.js v${version} is too old. Requires v${MIN_NODE_VERSION}+."
    info "Update from https://nodejs.org"
    exit 1
  fi

  success "Node.js $(node -v) detected"
}

detect_pm() {
  if command -v pnpm &>/dev/null; then
    echo "pnpm"
  elif command -v yarn &>/dev/null; then
    echo "yarn"
  elif command -v npm &>/dev/null; then
    echo "npm"
  else
    error "No package manager found (npm/yarn/pnpm)."
    exit 1
  fi
}

install_package() {
  local pm
  pm=$(detect_pm)
  info "Installing ${PACKAGE} via ${pm}..."

  case "$pm" in
    pnpm) pnpm add -g "$PACKAGE" ;;
    yarn) yarn global add "$PACKAGE" ;;
    npm)  npm install -g "$PACKAGE" ;;
  esac

  if ! command -v aireport &>/dev/null; then
    error "Installation succeeded but 'aireport' not found in PATH."
    warn "You may need to add the global bin directory to your PATH."
    exit 1
  fi

  success "${PACKAGE} installed"
}

run_setup() {
  info "Running setup wizard..."
  echo
  aireport install
}

main() {
  echo
  info "╔══════════════════════════════════╗"
  info "║   AI Report to Me — Installer   ║"
  info "╚══════════════════════════════════╝"
  echo

  check_node
  install_package
  echo
  run_setup
}

main
