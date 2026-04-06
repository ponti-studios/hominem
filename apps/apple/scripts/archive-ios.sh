#!/bin/zsh

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/release-common.sh"

apple_require_env APPLE_TEAM_ID

ARCHIVE_PATH="${HOMINEM_IOS_ARCHIVE_PATH:-${APPLE_BUILD_DIR}/HominemAppleiOS.xcarchive}"
EXPORT_PATH="${HOMINEM_IOS_EXPORT_PATH:-${APPLE_BUILD_DIR}/ios-export}"
EXPORT_OPTIONS_PATH="$(mktemp "${TMPDIR%/}/hominem-ios-export-options.XXXXXX.plist")"

trap 'rm -f "${EXPORT_OPTIONS_PATH}"' EXIT

mkdir -p "${APPLE_BUILD_DIR}"
rm -rf "${ARCHIVE_PATH}" "${EXPORT_PATH}"

apple_generate_project
apple_create_export_options "${EXPORT_OPTIONS_PATH}" "app-store"

apple_xcodebuild \
  -project "${APPLE_APP_DIR}/HominemApple.xcodeproj" \
  -scheme HominemAppleiOS \
  -configuration "${APPLE_CONFIGURATION}" \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID}" \
  CODE_SIGN_STYLE=Automatic \
  archive

apple_xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS_PATH}"

echo "iOS archive: ${ARCHIVE_PATH}"
echo "iOS export: ${EXPORT_PATH}"
