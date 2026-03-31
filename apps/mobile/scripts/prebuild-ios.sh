#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

# Prepare the iOS project for a specific mobile variant.
# It applies the right icons and then runs Expo prebuild.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/apps/mobile"
VARIANT="${1:-}"
PODFILE="${MOBILE_DIR}/ios/Podfile"
STAMP_FILE="${MOBILE_DIR}/ios/.app-variant"

if [[ -z "${VARIANT}" ]]; then
  fail "usage: prebuild-ios.sh <dev|e2e|preview|production>"
  exit 1
fi

step "Configuring iOS project for variant: ${VARIANT}"
cd "${MOBILE_DIR}"
bash scripts/setup-icons.sh "${VARIANT}"
bash scripts/with-variant.sh "${VARIANT}" bunx expo prebuild --platform ios --clean
ok "iOS project ready (${VARIANT})"
