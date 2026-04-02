#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

SCRIPTS_DIR="$(dirname "$0")"

header "Build Production"

# Step 1: Verify configuration for production variant
step "Verifying production configuration..."
bash "$SCRIPTS_DIR/verify.sh" production
ok "Configuration verified"

# Step 2: Run preflight checks
step "Running preflight checks..."
bash "$SCRIPTS_DIR/preflight.sh" production
ok "Preflight checks passed"

# Step 3: Confirm production build
if [[ "${SKIP_RELEASE_CONFIRMATION:-0}" != "1" ]]; then
  printf "\n"
  warn "You are about to build a production release"
  warn "This will increment version numbers and create a final release build"
  printf "\n"

  read -p "  Continue with production build? (yes/no): " confirm
  if [[ "$confirm" != "yes" ]]; then
    fail "Production build cancelled"
    exit 1
  fi
fi

printf "\n"

# Step 4: Trigger EAS build and submission for production
step "Building production with EAS..."
info "This waits for both platform builds and store submissions to finish"
info "A release manifest will be written to artifacts/releases/production-release-manifest.json"
printf "\n"

bun "$SCRIPTS_DIR/internal/orchestrate-release.ts" production --submit

printf "\n"
ok "Production build and submission finished successfully"
info "Review artifacts/releases/production-release-manifest.json for build and submission IDs"
printf "\n"
