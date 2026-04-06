#!/bin/zsh

set -euo pipefail

APPLE_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPLE_APP_DIR="$(cd "${APPLE_SCRIPT_DIR}/.." && pwd)"
APPLE_REPO_DIR="$(cd "${APPLE_APP_DIR}/../.." && pwd)"
APPLE_BUILD_DIR="${HOMINEM_APPLE_BUILD_DIR:-${APPLE_REPO_DIR}/build/apple}"
APPLE_CONFIGURATION="${HOMINEM_APPLE_CONFIGURATION:-Release}"

apple_require_env() {
  local name=""

  for name in "$@"; do
    if [[ -z "${(P)name:-}" ]]; then
      print -u2 "Missing required environment variable: ${name}"
      exit 1
    fi
  done
}

apple_generate_project() {
  (
    cd "${APPLE_APP_DIR}"
    xcodegen generate >/dev/null
  )
}

apple_xcodebuild() {
  if [[ "${APPLE_ALLOW_PROVISIONING_UPDATES:-0}" == "1" ]]; then
    xcodebuild -allowProvisioningUpdates "$@"
    return
  fi

  xcodebuild "$@"
}

apple_create_export_options() {
  local path="$1"
  local method="$2"

  cat >"${path}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${method}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${APPLE_TEAM_ID}</string>
</dict>
</plist>
EOF
}
