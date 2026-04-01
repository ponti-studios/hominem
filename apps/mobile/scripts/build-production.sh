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
printf "\n"
warn "You are about to build a production release"
warn "This will increment version numbers and create a final release build"
printf "\n"

read -p "  Continue with production build? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  fail "Production build cancelled"
  exit 1
fi

printf "\n"

# Step 4: Trigger EAS build for production
step "Building production with EAS..."
info "This will build for both iOS and Android platforms"
info "View progress at: https://expo.dev"
printf "\n"

eas build --platform all --profile production

printf "\n"
ok "Production build submitted to EAS"
info "Check your build status at: https://expo.dev"
info "Once complete, builds will be automatically submitted to App Store and Google Play"
printf "\n"
