#!/usr/bin/env bash

set -euo pipefail

if locale -a 2>/dev/null | grep -qix 'en_US.UTF-8'; then
  export LANG=en_US.UTF-8
  export LC_ALL=en_US.UTF-8
else
  export LANG=C.UTF-8
  export LC_ALL=C.UTF-8
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

for tool in xcodebuild xcrun python3 pnpm pod; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool" >&2
    exit 1
  fi
done

if ! DEVICE_JSON="$(xcrun xcdevice list --timeout 10)"; then
  echo "Couldn't list devices with 'xcrun xcdevice list'. Check that Xcode is installed and selected." >&2
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
  echo "No available physical iPhone found. Unlock it and connect it by USB or Wi-Fi." >&2
  exit 1
fi

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
    echo "Enter a number from 1 to ${#DEVICE_IDS[@]}" >&2
  done
else
  DEVICE_INDEX=0
fi

DEVICE_NAME="${DEVICE_NAMES[$DEVICE_INDEX]}"
DEVICE_ID="${DEVICE_IDS[$DEVICE_INDEX]}"
DERIVED_DATA="$APP_DIR/build/device-debug-derived-data"
APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphoneos/OmiroDev.app"

echo "Building the Debug development client for ${DEVICE_NAME}."
export APP_ENV=development
export EXPO_NO_DOTENV=1
pnpm run prebuild:dev

if [[ ! -d ios/OmiroDev.xcworkspace ]]; then
  echo "Prebuild did not produce ios/OmiroDev.xcworkspace." >&2
  exit 1
fi

xcodebuild \
  -quiet \
  -workspace ios/OmiroDev.xcworkspace \
  -scheme OmiroDev \
  -configuration Debug \
  -destination "platform=iOS,id=${DEVICE_ID}" \
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

if ! /usr/libexec/PlistBuddy -c 'Print :NSLocalNetworkUsageDescription' "$APP_PATH/Info.plist" >/dev/null 2>&1; then
  echo "The Debug app is missing Expo Dev Launcher local-network permission keys." >&2
  exit 1
fi

echo "Installing Omiro Dev on ${DEVICE_NAME}."
if ! xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"; then
  echo "Install failed. Unlock ${DEVICE_NAME}, trust this Mac, and enable Developer Mode if prompted." >&2
  exit 1
fi

echo "Installed Omiro Dev. Starting Expo on LAN; scan the QR code with your iPhone."
unset EXPO_NO_DOTENV
exec pnpm exec expo start --dev-client --lan
