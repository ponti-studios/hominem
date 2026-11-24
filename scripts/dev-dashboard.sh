#!/usr/bin/env bash
set -euo pipefail

# The dashboard itself, as a launchd user service: http://127.0.0.1:4599
# lists every com.ponti.* LaunchAgent, tails their logs, restarts live ones,
# and reaps stale entries whose worktree no longer exists.
#
# The service never points into a worktree: install copies scripts/
# dev-dashboard.mjs to ~/.hominem/dev-dashboard/ and runs that copy with an
# absolute node path, so deleting any worktree cannot break it. Re-run
# install to update the copy.
#
#   scripts/dev-dashboard.sh install    copy + load the LaunchAgent
#   scripts/dev-dashboard.sh uninstall  stop and remove it
#   scripts/dev-dashboard.sh status     loaded? running? url?
#   scripts/dev-dashboard.sh url        print the dashboard URL

REPO="$(git rev-parse --show-toplevel)"
LABEL="com.ponti.hominem-dev.dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
INSTALL_DIR="$HOME/.hominem/dev-dashboard"
INSTALLED="$INSTALL_DIR/dashboard.mjs"
LOG_DIR="$HOME/Library/Logs/hominem-dev"
LOG="$LOG_DIR/dashboard.log"
DOMAIN="gui/$(id -u)"
URL="http://127.0.0.1:4599"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

action="${1:-status}"

install_service() {
  local node_bin prefix roots
  node_bin="$(command -v node)"
  prefix="${DEV_DASHBOARD_PREFIX:-com.ponti.}"
  roots="${DEV_DASHBOARD_ROOTS:-$HOME/Developer:$HOME/.local/share/opencode/worktree}"
  mkdir -p "$INSTALL_DIR"
  cp "$REPO/scripts/dev-dashboard.mjs" "$INSTALLED"
  cat >"$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$node_bin</string>
    <string>$INSTALLED</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DEV_DASHBOARD_PREFIX</key><string>$prefix</string>
    <key>DEV_DASHBOARD_ROOTS</key><string>$roots</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "installed $LABEL"
  echo "script:  $INSTALLED (updated copy of scripts/dev-dashboard.mjs)"
  echo "filters: prefix=$prefix roots=$roots"
  echo "url:     $URL"
  echo "log:     $LOG"
}

uninstall_service() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL (install copy kept at $INSTALLED; log kept at $LOG)"
}

case "$action" in
  install) install_service ;;
  uninstall) uninstall_service ;;
  restart) launchctl kickstart -k "$DOMAIN/$LABEL"; echo "restarted $LABEL" ;;
  url) echo "$URL" ;;
  status)
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      launchctl print "$DOMAIN/$LABEL" | grep -E "^\s*(state|pid) " | sed 's/^ *//'
      echo "url: $URL"
    else
      echo "$LABEL is not loaded — install with: scripts/dev-dashboard.sh install"
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 {install|uninstall|restart|status|url}" >&2
    exit 2
    ;;
esac
