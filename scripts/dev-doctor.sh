#!/usr/bin/env bash
set -euo pipefail

PASS="✅"; WARN="⚠️ "; FAIL="❌"
failures=0; warnings=0

check() {
  local name="$1" required="$2"; shift 2
  local label; label="$([ "$required" = "1" ] && echo required || echo recommended)"
  local out
  if out=$("$@" 2>&1); then
    echo "$PASS $name ($label)"
    echo "   $(echo "$out" | head -1)"
  else
    echo "$( [ "$required" = "1" ] && echo "$FAIL" || echo "$WARN") $name ($label)"
    echo "   not found or failed"
    [ "$required" = "1" ] && failures=$((failures + 1)) || warnings=$((warnings + 1))
  fi
}

echo ""
echo "Hominem Developer Environment Doctor"
echo "-------------------------------------"

check "Bun"            1 bun --version
check "Node.js"        1 node --version
check "Git"            1 git --version
check "Docker"         1 docker --version
check "Docker Compose" 1 docker compose version
check "Python 3"       1 python3 --version
check "tsgo (native TypeScript)" 1 bunx tsgo --version
check "Watchman"       0 watchman --version
check "jq"             0 jq --version

if [[ "$(uname)" == "Darwin" ]] && [ -d "apps/mobile" ]; then
  check "ImageMagick"              0 magick --version
  check "Xcode"                    1 xcodebuild -version
  check "Xcode Command Line Tools" 1 xcode-select -p
  check "CocoaPods"                0 pod --version
  check "Java (Android toolchain)" 0 java -version
  check "ADB"                      0 adb version
fi

echo ""
echo "Result"
echo "------"
if [ "$failures" -gt 0 ]; then
  echo "$FAIL $failures required check(s) failed"
  exit 1
elif [ "$warnings" -gt 0 ]; then
  echo "$PASS Required checks passed ($warnings recommendation(s) to review)"
else
  echo "$PASS All checks passed"
fi
