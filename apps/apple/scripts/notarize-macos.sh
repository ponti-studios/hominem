#!/bin/zsh

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/release-common.sh"

apple_require_env APPLE_TEAM_ID APPLE_NOTARY_PROFILE

"${APPLE_SCRIPT_DIR}/archive-macos.sh"

EXPORT_PATH="${HOMINEM_MACOS_EXPORT_PATH:-${APPLE_BUILD_DIR}/macos-export}"
APP_PATH="${HOMINEM_MACOS_APP_PATH:-${EXPORT_PATH}/HominemAppleMac.app}"
ZIP_PATH="${HOMINEM_MACOS_NOTARY_ZIP_PATH:-${APPLE_BUILD_DIR}/HominemAppleMac-notarization.zip}"

rm -f "${ZIP_PATH}"

ditto -c -k --keepParent "${APP_PATH}" "${ZIP_PATH}"
xcrun notarytool submit "${ZIP_PATH}" --keychain-profile "${APPLE_NOTARY_PROFILE}" --wait
xcrun stapler staple "${APP_PATH}"
spctl -a -t exec -vv "${APP_PATH}"

echo "Notarized app: ${APP_PATH}"
