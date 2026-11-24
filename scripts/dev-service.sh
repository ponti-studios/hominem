#!/usr/bin/env bash
set -euo pipefail

# Run this worktree's dev stack as a launchd user service: it outlives
# terminal sessions and agent shells, restarts after a crash, and appends all
# output to a stable log file anyone (including agents) can read.
#
#   scripts/dev-service.sh install    render + load the LaunchAgent
#   scripts/dev-service.sh uninstall  stop and remove it
#   scripts/dev-service.sh restart    bounce the stack
#   scripts/dev-service.sh status     loaded? running? which pid?
#   scripts/dev-service.sh logs [n]   print the last n lines (default 200)
#   scripts/dev-service.sh logs -f    follow the log

REPO="$(git rev-parse --show-toplevel)"
NAME="$(basename "$REPO" | tr ' ' '-')"
LABEL="com.ponti.hominem-dev.$NAME"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/hominem-dev"
LOG="$LOG_DIR/$NAME.log"
DOMAIN="gui/$(id -u)"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

action="${1:-status}"
shift || true

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
    <string>cd "$REPO" &amp;&amp; exec pnpm dev</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$PATH</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "installed $LABEL"
  echo "worktree: $REPO"
  echo "log:      $LOG"
  echo "manage:   scripts/dev-service.sh status | restart | uninstall"
}

uninstall_service() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL (log kept at $LOG)"
}

status_service() {
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    launchctl print "$DOMAIN/$LABEL" | grep -E "^\s*(state|pid|last exit code) " | sed 's/^ *//'
  else
    echo "$LABEL is not loaded — install with: scripts/dev-service.sh install"
    exit 1
  fi
}

case "$action" in
  install) install_service ;;
  uninstall) uninstall_service ;;
  restart) launchctl kickstart -k "$DOMAIN/$LABEL"; echo "restarted $LABEL" ;;
  status) status_service ;;
  logs)
    if [ "${1:-}" = "-f" ]; then
      exec tail -n 200 -f "$LOG"
    fi
    tail -n "${1:-200}" "$LOG"
    ;;
  *)
    echo "usage: $0 {install|uninstall|restart|status|logs [n|-f]}" >&2
    exit 2
    ;;
esac
