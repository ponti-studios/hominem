#!/usr/bin/env bash
set -euo pipefail

# Run this worktree's dev stack as a launchd user service: it outlives
# terminal sessions and agent shells, restarts after a crash, and appends all
# output to a stable log file anyone (including agents) can read.
#
# The LaunchAgent is bound to this worktree by design, so it also cleans up
# after itself: when the worktree directory disappears, the agent boots itself
# out and removes its plist (exit 0, so KeepAlive does not fight it).
#
#   scripts/dev-service.sh install    render + load the LaunchAgent
#   scripts/dev-service.sh uninstall  stop and remove it
#   scripts/dev-service.sh prune      remove agents whose worktree is gone
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
  # The guard before `cd` is the self-cleanup: launchd starts this command
  # even after the worktree is gone, so it reaps its own agent and exits 0.
  local command
  command="if [ ! -d \"$REPO\" ]; then rm -f \"$PLIST\"; launchctl bootout \"$DOMAIN/$LABEL\" 2>/dev/null; exit 0; fi; cd \"$REPO\" && exec pnpm dev"
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
    <string>$(printf '%s' "$command" | sed 's/&/\&amp;/g')</string>
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
  sleep 1
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "installed $LABEL"
  echo "worktree: $REPO"
  echo "log:      $LOG"
  echo "manage:   scripts/dev-service.sh status | restart | uninstall"
  echo "note:     the agent removes itself once this worktree is deleted"
}

uninstall_service() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL (log kept at $LOG)"
}

prune_service() {
  local pruned=0
  for plist in "$HOME/Library/LaunchAgents"/com.ponti.hominem-dev.*.plist; do
    [ -e "$plist" ] || continue
    case "$plist" in *com.ponti.hominem-dev.dashboard.plist) continue ;; esac
    local label worktree
    label="$(plutil -extract Label raw -o - "$plist" 2>/dev/null || true)"
    worktree="$(plutil -extract ProgramArguments.2 raw -o - "$plist" 2>/dev/null | sed -n 's/.*cd "\([^"]*\)".*/\1/p')"
    if [ -n "$worktree" ] && [ ! -d "$worktree" ]; then
      launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
      rm -f "$plist"
      echo "pruned $label (worktree gone: $worktree)"
      pruned=$((pruned + 1))
    fi
  done
  [ "$pruned" -eq 0 ] && echo "nothing to prune"
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
  prune) prune_service ;;
  restart) launchctl kickstart -k "$DOMAIN/$LABEL"; echo "restarted $LABEL" ;;
  status) status_service ;;
  logs)
    if [ "${1:-}" = "-f" ]; then
      exec tail -n 200 -f "$LOG"
    fi
    tail -n "${1:-200}" "$LOG"
    ;;
  *)
    echo "usage: $0 {install|uninstall|prune|restart|status|logs [n|-f]}" >&2
    exit 2
    ;;
esac
