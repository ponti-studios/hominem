#!/bin/zsh

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/release-common.sh"

apple_require_env APPLE_TEAM_ID

ARCHIVE_PATH="${HOMINEM_MACOS_ARCHIVE_PATH:-${APPLE_BUILD_DIR}/HominemAppleMac.xcarchive}"
EXPORT_PATH="${HOMINEM_MACOS_EXPORT_PATH:-${APPLE_BUILD_DIR}/macos-export}"
EXPORT_OPTIONS_PATH="$(mktemp "${TMPDIR%/}/hominem-macos-export-options.XXXXXX.plist")"

trap 'rm -f "${EXPORT_OPTIONS_PATH}"' EXIT

mkdir -p "${APPLE_BUILD_DIR}"
rm -rf "${ARCHIVE_PATH}" "${EXPORT_PATH}"

apple_generate_project
apple_create_export_options "${EXPORT_OPTIONS_PATH}" "developer-id"

apple_xcodebuild \
  -project "${APPLE_APP_DIR}/HominemApple.xcodeproj" \
  -scheme HominemAppleMac \
  -configuration "${APPLE_CONFIGURATION}" \
  -destination 'generic/platform=macOS' \
  -archivePath "${ARCHIVE_PATH}" \
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID}" \
  CODE_SIGN_STYLE=Automatic \
  archive

apple_xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS_PATH}"

echo "macOS archive: ${ARCHIVE_PATH}"
echo "macOS export: ${EXPORT_PATH}"
