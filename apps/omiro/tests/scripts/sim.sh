#!/usr/bin/env bash
# Builds the Omiro dev client for the booted simulator (ad-hoc signed, so the Keychain works),
# installs it and records the native fingerprint. Skips the build when nothing native changed.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$APP_DIR/tests/scripts"
APP_ID="${APP_ID:-com.pontistudios.hakumi.dev}"
DERIVED="${OMIRO_DERIVED_DATA:-$HOME/Library/Caches/omiro-dev-client}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
note() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

udid="${STUDIO_SIM:-$(xcrun simctl list devices booted -j | jq -r '[.devices[][] | select(.state=="Booted") | .udid][0] // empty')}"
[[ -n "$udid" ]] || fail 'No simulator is booted. Run: xcrun simctl boot "iPhone 17 Pro"'

want="$("$SCRIPT_DIR/native-hash.sh")"
app="$DERIVED/Build/Products/Debug-iphonesimulator/OmiroDev.app"
# The fingerprint is kept beside the build, not inside it: an extra file would break the app's signature.
if [[ -d "$app" && "$(cat "$DERIVED/built.hash" 2>/dev/null || true)" == "$want" && "${FORCE:-0}" != 1 ]]; then
  note 'Native dependencies unchanged; reusing the built dev client'
else
  note 'Prebuild'
  cd "$APP_DIR"
  APP_ENV=development pnpm exec expo prebuild --platform ios --no-install
  (cd ios && pod install)
  note 'Build (ad-hoc signed)'
  (cd ios && xcodebuild -workspace OmiroDev.xcworkspace -scheme OmiroDev -configuration Debug \
    -destination "id=$udid" -derivedDataPath "$DERIVED" \
    CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES build | tail -n 5)
  # Prebuild can touch the files the fingerprint covers, so take it again once the build is done.
  want="$("$SCRIPT_DIR/native-hash.sh")"
  printf '%s' "$want" >"$DERIVED/built.hash"
fi

note "Install on $udid"
xcrun simctl terminate "$udid" "$APP_ID" 2>/dev/null || true
xcrun simctl install "$udid" "$app"
printf '%s' "$want" >"$DERIVED/installed-$udid.hash"
echo "Installed. Next: just mobile run (Metro), or just mobile e2e."
