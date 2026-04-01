#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

SCRIPTS_DIR="$(dirname "$0")"

header "Build Preview"

# Step 1: Verify configuration for preview variant
step "Verifying preview configuration..."
bash "$SCRIPTS_DIR/verify.sh" preview
ok "Configuration verified"

# Step 2: Run preflight checks
step "Running preflight checks..."
bash "$SCRIPTS_DIR/preflight.sh" preview
ok "Preflight checks passed"

# Step 3: Trigger EAS build for preview
step "Building preview with EAS..."
info "This will build for both iOS and Android platforms"
info "View progress at: https://expo.dev"
printf "\n"

eas build --platform all --profile preview

printf "\n"
ok "Preview build submitted to EAS"
info "Check your build status at: https://expo.dev"
printf "\n"
