#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

VARIANT="${1:?usage: verify.sh <dev|e2e|preview|production>}"

# Validate variant
case "$VARIANT" in
  dev|e2e|preview|production) ;;
  *)
    fail "Invalid variant: $VARIANT (must be dev, e2e, preview, or production)"
    exit 1
    ;;
esac

SCRIPTS_DIR="$(dirname "$0")"

header "Verification · $VARIANT"

# Run concurrent checks (no dependencies between them)
step "Running configuration checks..."
bash "$SCRIPTS_DIR/internal/check-eas-profiles.sh" &
PID_EAS=$!

bash "$SCRIPTS_DIR/internal/check-expo-config.sh" &
PID_EXPO=$!

bunx tsx "$SCRIPTS_DIR/internal/check-style-tokens.ts" &
PID_TOKENS=$!

# Wait for all concurrent checks to complete
if ! wait $PID_EAS; then
  fail "EAS profiles validation failed"
  exit 1
fi
if ! wait $PID_EXPO; then
  fail "Expo configuration validation failed"
  exit 1
fi
if ! wait $PID_TOKENS; then
  fail "Design tokens validation failed"
  exit 1
fi

ok "Configuration checks passed"

# Variant-specific environment checks (only for release variants)
if [[ "$VARIANT" == "preview" || "$VARIANT" == "production" ]]; then
  step "Running release environment checks for $VARIANT..."
  bash "$SCRIPTS_DIR/internal/check-release-env.sh" "$VARIANT"
  ok "Release environment checks passed"
fi

printf "\n"
ok "All verifications passed for $VARIANT"
printf "\n"
