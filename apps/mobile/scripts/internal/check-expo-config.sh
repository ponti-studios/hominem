#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPTS_DIR}/../.." && pwd)"
cd "$MOBILE_DIR"

bun run scripts/internal/validate-expo-config.ts
