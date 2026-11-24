#!/usr/bin/env bash
set -euo pipefail

# The dashboard itself, as a launchd user service: http://127.0.0.1:4599
# lists every com.ponti.* LaunchAgent, tails their logs, and can restart one.
#
#   scripts/dev-dashboard.sh install    render + load the LaunchAgent
#   scripts/dev-dashboard.sh uninstall  stop and remove it
#   scripts/dev-dashboard.sh status     loaded? running? url?
#   scripts/dev-dashboard.sh url        print the dashboard URL

REPO="$(git rev-parse --show-toplevel)"
LABEL="com.ponti.hominem-dev.dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/hominem-dev"
LOG="$LOG_DIR/dashboard.log"
DOMAIN="gui/$(id -u)"
URL="http://127.0.0.1:4599"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

action="${1:-status}"

install_service() {
  cat >"$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$REPO" &amp;&amp; exec pnpm exec tsx scripts/dev-dashboard.ts</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$PATH</string>
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
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "installed $LABEL"
  echo "url: $URL"
  echo "log: $LOG"
}

uninstall_service() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL (log kept at $LOG)"
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
