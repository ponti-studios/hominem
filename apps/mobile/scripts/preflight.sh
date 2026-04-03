#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

CHANNEL="${1:?usage: preflight.sh <dev|preview|production>}"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPTS_DIR}/.." && pwd)"

header "Preflight · $CHANNEL"

cd "$MOBILE_DIR"

if [[ "$CHANNEL" == "preview" || "$CHANNEL" == "production" ]] && ! command -v eas >/dev/null 2>&1; then
   fail "EAS CLI not found. Install eas-cli before running release preflight checks."
   exit 1
fi

bash "$SCRIPTS_DIR/internal/check-eas-profiles.sh"
bun run "$SCRIPTS_DIR/internal/validate-expo-config.ts"

if [[ "$CHANNEL" == "preview" || "$CHANNEL" == "production" ]]; then
   eas env:exec "$CHANNEL" "bash scripts/internal/check-release-env.sh $CHANNEL"
fi

printf "\n"
