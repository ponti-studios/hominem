#!/usr/bin/env bash
# shellcheck disable=SC2034  # SHIP_* are read by the sourced ship-ios.sh
# Ship Omiro to TestFlight, the studio's way (.studio/ship-ios.sh): a local IPA, then App Store Connect,
# with no EAS cloud build. Usage: scripts/ship-omiro.sh [--skip-checks] [--no-upload] [--allow-branch]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../.studio/lib.sh
source "$ROOT/.studio/lib.sh"
# shellcheck source=../.studio/ship-ios.sh
source "$ROOT/.studio/ship-ios.sh"

SHIP_NAME=Omiro
SHIP_ROOT="$ROOT"
APP_DIR="$ROOT/apps/omiro"
IPA="$APP_DIR/build/prod-local.ipa"
EXPECTED_BUNDLE_ID=com.pontistudios.hakumi
ipa_plist_value() { unzip -p "$IPA" 'Payload/*.app/Info.plist' | plutil -extract "$1" raw -o - -; }

ship_check() {
  (cd "$ROOT" && just mobile check)
}

ship_build() {
  need pnpm 'Install pnpm.'
  # The production variables (New Relic tokens among them) come from EAS into the gitignored .eas-prod.local.
  (cd "$APP_DIR" && pnpm eas:pull:prod)
  # build:prod:local checks the release identity, loads .eas-prod.local, and builds with `eas build --local`.
  (cd "$APP_DIR" && pnpm build:prod:local)
  [[ -f "$IPA" ]] || fail "No IPA at $IPA."
  SHIP_ARTIFACT="$IPA"
  SHIP_VERSION="$(ipa_plist_value CFBundleShortVersionString)"
  SHIP_BUILD="$(ipa_plist_value CFBundleVersion)"
}

ship_audit() {
  local id
  id="$(ipa_plist_value CFBundleIdentifier)"
  [[ "$id" == "$EXPECTED_BUNDLE_ID" ]] || fail "The IPA is $id, not $EXPECTED_BUNDLE_ID. Do not ship it."
  ok "release identity $id ($SHIP_VERSION, build $SHIP_BUILD)"
}

# Symbols and source maps are uploaded during the build by the New Relic Expo plugin, using
# EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN and NEWRELIC_USER_API_KEY (a User key, NRAK-) from .eas-prod.local.
ship_symbols() {
  local key
  key="$(grep -h '^NEWRELIC_USER_API_KEY=' "$APP_DIR/.eas-prod.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'[:space:]")"
  [[ "$key" == NRAK-* ]] || warn 'NEWRELIC_USER_API_KEY in EAS is not a User key (NRAK-); source maps were not accepted.'
}

ship_upload() {
  (cd "$APP_DIR" && pnpm submit:local)
}

ship_ios "$@"
