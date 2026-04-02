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
info "This waits for both iOS and Android builds to reach a terminal state"
info "A release manifest will be written to artifacts/releases/preview-release-manifest.json"
printf "\n"

bun "$SCRIPTS_DIR/internal/orchestrate-release.ts" preview

printf "\n"
ok "Preview build finished successfully"
info "Review artifacts/releases/preview-release-manifest.json for build IDs and status details"
printf "\n"
