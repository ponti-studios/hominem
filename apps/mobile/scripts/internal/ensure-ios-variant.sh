#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../_lib.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VARIANT="${1:-}"
STAMP_FILE="${MOBILE_DIR}/ios/.app-variant"

if [[ -z "${VARIANT}" ]]; then
  fail "usage: ensure-ios-variant.sh <dev|e2e|preview|production>"
  exit 1
fi

step "Configuring iOS project for variant: ${VARIANT}"
cd "${MOBILE_DIR}"
bash scripts/internal/setup-icons.sh "${VARIANT}"
bash scripts/internal/run-variant.sh "${VARIANT}" bunx expo prebuild --platform ios --clean
printf '%s\n' "${VARIANT}" > "${STAMP_FILE}"
ok "iOS project ready (${VARIANT})"
