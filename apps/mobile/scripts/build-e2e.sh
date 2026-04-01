#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

SCRIPTS_DIR="$(dirname "$0")"

header "Build E2E Test App"

info 'Detox will use the simulator configured in `.detoxrc.js`'
info 'Override with `DETOX_SIMULATOR_DEVICE` and `DETOX_SIMULATOR_OS` to pick a different simulator'
info 'Set `DETOX_SIMULATOR_UDID` only if you need an exact installed simulator'

# Step 1: Verify configuration for e2e variant
step "Verifying e2e configuration..."
bash "$SCRIPTS_DIR/verify.sh" e2e
ok "Configuration verified"

# Step 2: Always regenerate iOS project for e2e
step "Regenerating iOS project for e2e testing..."
bash "$SCRIPTS_DIR/internal/ensure-ios-variant.sh" e2e
ok "iOS project regenerated"

# Step 3: Build e2e test app with Detox
step "Building e2e test app..."
info "Building iOS simulator app for e2e testing"
printf "\n"

detox build -c ios.sim.e2e

printf "\n"
ok "E2E test app built successfully"
info 'If build fails with a destination error, run: xcrun simctl list devices available'
info 'Then set: DETOX_SIMULATOR_DEVICE=<device> DETOX_SIMULATOR_OS=<runtime>'
info 'Or set: DETOX_SIMULATOR_UDID=<available-udid>'
printf "\n"
