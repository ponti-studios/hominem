#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../_lib.sh"

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPTS_DIR}/../.." && pwd)"

cd "$MOBILE_DIR"

STDERR_FILE="$(mktemp)"
if ! CONFIG_JSON="$(bunx --yes expo config --json --type public 2>"$STDERR_FILE")"; then
  if [[ -s "$STDERR_FILE" ]]; then
    cat "$STDERR_FILE" >&2
  fi
  rm -f "$STDERR_FILE"
  fail "Failed to resolve Expo public config"
  exit 1
fi

if [[ -s "$STDERR_FILE" ]]; then
  cat "$STDERR_FILE" >&2
fi
rm -f "$STDERR_FILE"

export CONFIG_JSON

node -e "
const { EXPO_OWNER, EXPO_PROJECT_ID, EXPO_PROJECT_SLUG } = require('./config/expo-config.js')

const config = JSON.parse(process.env.CONFIG_JSON ?? '{}')
const resolvedConfig = {
  owner: config.owner,
  projectId: config.extra?.eas?.projectId,
  slug: config.slug,
}
const expectedConfig = {
  owner: EXPO_OWNER,
  projectId: EXPO_PROJECT_ID,
  slug: EXPO_PROJECT_SLUG,
}

if (JSON.stringify(resolvedConfig) !== JSON.stringify(expectedConfig)) {
  throw new Error(
    'Expo config mismatch: expected ' +
      JSON.stringify(expectedConfig) +
      ', got ' +
      JSON.stringify(resolvedConfig),
  )
}

if (config.extra?.mobilePasskeyEnabled === undefined) {
  throw new Error('Expo config mismatch: extra.mobilePasskeyEnabled must be present')
}
"

ok "Expo config"
