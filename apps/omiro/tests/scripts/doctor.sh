#!/usr/bin/env bash
# Read-only checks for running Omiro on a simulator. Says what to fix; changes nothing.
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/../.." && pwd)"
APP_ID="${APP_ID:-com.pontistudios.hakumi.dev}"
problems=0
ok() { printf '  ok   %s\n' "$*"; }
bad() { printf '  FIX  %s\n' "$*"; problems=$((problems + 1)); }

echo '== Tools'
command -v xcodebuild >/dev/null && ok "$(xcodebuild -version | head -n 1)" || bad 'Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app'
command -v pnpm >/dev/null && ok 'pnpm' || bad 'Install pnpm'
command -v maestro >/dev/null || [[ -x "$HOME/.maestro/bin/maestro" ]] && ok 'maestro' || bad 'Install Maestro (~/.maestro/bin)'
java -version 2>&1 | grep -q '17\.' && ok 'Java 17' || bad 'Install Java 17 (brew install openjdk@17); Maestro needs it'

echo '== Local setup'
[[ -d "$REPO_DIR/node_modules" ]] && ok 'dependencies installed' || bad 'Run: just mobile setup'
[[ -d "$REPO_DIR/packages/auth/build" ]] && ok '@ponti-studios/auth built' || bad 'Run: just mobile setup (the app cannot bundle without it)'
[[ -f "$REPO_DIR/services/api/.env.scripted" ]] && ok '.env.scripted present' || bad 'services/api/.env.scripted is missing'

echo '== Simulator and dev client'
booted="$(xcrun simctl list devices booted -j | jq -r '[.devices[][] | select(.state=="Booted") | .udid][0] // empty')"
if [[ -z "$booted" ]]; then
  bad 'No simulator is booted. Run: xcrun simctl boot "iPhone 17 Pro"'
else
  ok "booted simulator $booted"
  app="$(xcrun simctl get_app_container "$booted" "$APP_ID" app 2>/dev/null || true)"
  if [[ -z "$app" ]]; then
    bad "Dev client $APP_ID is not installed. Run: just mobile sim"
  else
    ok 'dev client installed'
    want="$("$(dirname "${BASH_SOURCE[0]}")/native-hash.sh")"
    installed="$(cat "${OMIRO_DERIVED_DATA:-$HOME/Library/Caches/omiro-dev-client}/installed-$booted.hash" 2>/dev/null || true)"
    [[ "$installed" == "$want" ]] && ok 'dev client matches the native dependencies' ||
      bad 'Dev client is older than the native dependencies (or was built elsewhere). Run: just mobile sim'
  fi
fi

echo '== Ports and services'
for port in 8082 4040; do
  if lsof -iTCP:"$port" -sTCP:LISTEN -P -n >/dev/null 2>&1; then ok "port $port in use (already running?)"; else ok "port $port free"; fi
done

echo
((problems == 0)) && echo 'All good.' || { echo "$problems thing(s) to fix."; exit 1; }
