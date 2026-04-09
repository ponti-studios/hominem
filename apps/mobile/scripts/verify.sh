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
MOBILE_DIR="$(cd "$SCRIPTS_DIR/../.." && pwd)"
export APP_VARIANT="$VARIANT"

# cd into mobile root so relative paths in scripts resolve correctly
cd "$MOBILE_DIR"

header "Verification · $VARIANT"

# Run validation checks in sequence to avoid Bun/Expo loader races.
step "Running configuration checks..."
if ! bash "$SCRIPTS_DIR/internal/check-eas-profiles.sh"; then
  fail "EAS profiles validation failed"
  exit 1
fi

if ! bun run "$SCRIPTS_DIR/internal/validate-expo-config.ts"; then
  fail "Expo configuration validation failed"
  exit 1
fi

if ! bun "$SCRIPTS_DIR/internal/check-style-tokens.ts"; then
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
