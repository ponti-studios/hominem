#!/usr/bin/env bash
# Canonical local entry point for Omiro's Maestro flows. It deliberately owns
# process cleanup, device/app/API checks, and authentication so individual
# flows can start from the same known signed-in state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TESTS_DIR="$APP_DIR/tests"
APP_ID="${APP_ID:-com.pontistudios.hakumi.dev}"
API_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:4040}"

export PATH="$HOME/.maestro/bin:/opt/homebrew/opt/openjdk@17/bin:$PATH"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_DISABLE_UPDATE_CHECK=true

fail() {
  echo "maestro preflight: $*" >&2
  exit 1
}

command -v maestro >/dev/null || fail 'maestro is not installed at ~/.maestro/bin/maestro'
command -v java >/dev/null || fail 'Java 17 is required by Maestro'
java_version="$(java -version 2>&1 | head -n 1)"
[[ "$java_version" == *'17.'* ]] || fail "Java 17 is required; found $java_version"

booted_udid="$(xcrun simctl list devices booted -j | jq -r '.devices | to_entries[] | .value[] | select(.state == "Booted") | .udid' | head -n 1)"
[[ -n "$booted_udid" ]] || fail 'no iOS simulator is booted'
xcrun simctl get_app_container "$booted_udid" "$APP_ID" app >/dev/null 2>&1 || fail "$APP_ID is not installed on the booted simulator"

status_json="$(curl --fail --silent --show-error --max-time 5 "$API_URL/api/status")" ||
  fail "API is not reachable at $API_URL"

# The suite assumes deterministic, no-cost providers (fixed replies, no real
# LLM/email calls). An API not started with ENV=scripted silently makes real
# OpenRouter calls instead, which is non-deterministic, costs real tokens,
# and is what produced "Could not start chat" failures the first time this
# ran against an ordinary `pnpm dev` API.
ai_provider="$(jq -r '.providers.ai // empty' <<<"$status_json")"
email_provider="$(jq -r '.providers.email // empty' <<<"$status_json")"
if [[ "$ai_provider" != 'scripted' || "$email_provider" != 'scripted' ]]; then
  fail "API at $API_URL is not running with ENV=scripted (ai=${ai_provider:-unknown}, email=${email_provider:-unknown}). Restart it with ENV=scripted before running this suite."
fi

# A cancelled Maestro run can leave its XCTest bridge holding port 7001. Do
# this for every run, not just auth, before a new bridge is created.
pkill -f '\.maestro/lib' 2>/dev/null || true
pkill -f 'test-without-building' 2>/dev/null || true
pkill -f 'maestro-driver-iosUITests-Runner' 2>/dev/null || true
sleep 1

"$SCRIPT_DIR/maestro-auth.sh"

if [[ $# -eq 0 ]]; then
  # Pass the workspace root, not tests/flows: config.yaml's own flow
  # patterns (flows/**, e2e/**, !subflows/**) are re-applied relative to
  # whatever directory is passed here, so pointing at tests/flows makes
  # Maestro look for tests/flows/flows/** and match nothing.
  set -- "$TESTS_DIR"
fi

exec maestro test --config "$TESTS_DIR/config.yaml" "$@"
