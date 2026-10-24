#!/usr/bin/env bash

set -euo pipefail

# CocoaPods (Ruby) crashes with an encoding error under a non-UTF-8 locale and
# hides the real pod install failure, so force UTF-8.
# Prefer en_US.UTF-8 (always on macOS), fall back to C.UTF-8 if it's missing.
if locale -a 2>/dev/null | grep -qix 'en_US.UTF-8'; then
  UTF8_LOCALE=en_US.UTF-8
else
  UTF8_LOCALE=C.UTF-8
fi
export LANG="$UTF8_LOCALE"
export LC_ALL="$UTF8_LOCALE"

for tool in xcodebuild xcrun python3 pnpm pod; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool. Install Xcode (plus its command line tools), pnpm and CocoaPods first." >&2
    exit 1
  fi
done

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(git -C "$APP_DIR" rev-parse --show-toplevel)"
cd "$APP_DIR"

BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
DERIVED_DATA="$APP_DIR/build/device-derived-data"
APP_PATH="$DERIVED_DATA/Build/Products/Release-iphoneos/OmiroDev.app"

echo "Building Omiro Dev from ${BRANCH:-detached HEAD} at ${COMMIT}, including current working-tree changes."

# Reuse the locally pulled production API configuration without printing any
# values from this file. Development identity keeps this install separate from
# the App Store app, while its JS bundle talks to production.
if [[ -f .eas-prod.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .eas-prod.local
  set +a
else
  echo "Missing apps/omiro/.eas-prod.local. Run 'pnpm eas:pull:prod' first." >&2
  exit 1
fi

if [[ "${EXPO_PUBLIC_API_BASE_URL:-}" != "https://api.ponti.io" ]]; then
  echo "EXPO_PUBLIC_API_BASE_URL in .eas-prod.local is not the production API. Refusing to build." >&2
  exit 1
fi

export APP_ENV=development
export EXPO_NO_DOTENV=1

if ! DEVICE_JSON="$(xcrun xcdevice list --timeout 10)"; then
  echo "Couldn't list devices with 'xcrun xcdevice list'. Check that Xcode is installed and selected ('xcode-select -p')." >&2
  exit 1
fi
DEVICE_ROWS="$(printf '%s' "$DEVICE_JSON" | python3 -c '
import json, sys
devices = json.load(sys.stdin)
for device in devices:
    if (device.get("platform") == "com.apple.platform.iphoneos"
            and not device.get("simulator")
            and device.get("modelName", "").startswith("iPhone")
            and device.get("available")
            and device.get("identifier")
            and device.get("name")):
        print("{}\t{}".format(device["name"], device["identifier"]))
')"

DEVICE_NAMES=()
DEVICE_IDS=()
while IFS=$'\t' read -r name identifier; do
  [[ -n "$identifier" ]] || continue
  DEVICE_NAMES+=("$name")
  DEVICE_IDS+=("$identifier")
done <<< "$DEVICE_ROWS"

if (( ${#DEVICE_IDS[@]} == 0 )); then
  echo "No available physical iPhone found. Unlock it and connect it by USB or on the same Wi-Fi network." >&2
  exit 1
fi

DEVICE_INDEX=0
if (( ${#DEVICE_IDS[@]} > 1 )); then
  if [[ ! -t 0 ]]; then
    echo "More than one iPhone is available; run this script in a terminal to choose one:" >&2
    printf '  - %s\n' "${DEVICE_NAMES[@]}" >&2
    exit 1
  fi

  echo "Choose the iPhone to install to:"
  for i in "${!DEVICE_NAMES[@]}"; do
    printf '  %d) %s\n' "$((i + 1))" "${DEVICE_NAMES[$i]}"
  done
  while true; do
    read -r -p "Device number: " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#DEVICE_IDS[@]} )); then
      DEVICE_INDEX=$((choice - 1))
      break
    fi
    echo "Enter a number from 1 to ${#DEVICE_IDS[@]}." >&2
  done
fi

DEVICE_NAME="${DEVICE_NAMES[$DEVICE_INDEX]}"
DEVICE_ID="${DEVICE_IDS[$DEVICE_INDEX]}"
echo "Selected ${DEVICE_NAME}."

# ios/ is gitignored, so generate the development workspace (OmiroDev scheme) first.
pnpm run prebuild:dev

# expo prebuild can swallow a failing 'pod install' and exit 0, which only
# shows up later as a missing workspace. Catch it here with a clear message.
if [[ ! -d ios/OmiroDev.xcworkspace ]]; then
  echo "Prebuild did not produce ios/OmiroDev.xcworkspace. Look for a 'pod install' error in the output above." >&2
  exit 1
fi

xcodebuild \
  -quiet \
  -workspace ios/OmiroDev.xcworkspace \
  -scheme OmiroDev \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Build completed without the expected app at $APP_PATH" >&2
  exit 1
fi

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist")"
if [[ "$BUNDLE_ID" != "com.pontistudios.hakumi.dev" ]]; then
  echo "Unexpected app identity ($BUNDLE_ID). Refusing to install." >&2
  exit 1
fi

python3 - "$APP_PATH/main.jsbundle" <<'PY'
import pathlib
import sys

bundle = pathlib.Path(sys.argv[1]).read_bytes()
if b"https://api.ponti.io" not in bundle or b"localhost:4040" in bundle:
    raise SystemExit("The app bundle does not resolve exclusively to the production API.")
PY

echo "Installing Omiro Dev on ${DEVICE_NAME}..."
if ! xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"; then
  echo "Install failed. Make sure ${DEVICE_NAME} is unlocked, trusts this Mac, and has Developer Mode on (Settings > Privacy & Security)." >&2
  exit 1
fi
echo "Launching Omiro Dev..."
# The install is done at this point. A locked phone only blocks the auto-launch,
# so don't report the whole run as failed.
if xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"; then
  echo "Installed and launched Omiro Dev on ${DEVICE_NAME}; API endpoint is production."
else
  echo "Installed Omiro Dev on ${DEVICE_NAME}, but couldn't launch it (is the phone locked?). Unlock it and open the app; API endpoint is production."
fi
