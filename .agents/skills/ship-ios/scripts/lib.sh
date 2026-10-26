#!/usr/bin/env bash
# Shared shell helpers for studio repos. Source it: `source .studio/lib.sh`.
# Vendored from studio-dev; change it there, not in the repo that holds the copy.

note() { printf '\n==> %s\n' "$*"; }
ok() { printf '  ok   %s\n' "$*"; }
warn() { printf '  warn %s\n' "$*" >&2; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Exits with a fix when a command is missing: need <command> "how to get it".
need() { command -v "$1" >/dev/null 2>&1 || fail "$1 is missing. $2"; }

# Reads a value from .studio/ports.env: port_of THAMES_METRO_PORT
port_of() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  grep -E "^$1=" "$here/ports.env" | head -n 1 | cut -d= -f2
}

# True when nothing is listening on the port.
port_free() { ! lsof -iTCP:"$1" -sTCP:LISTEN -P -n >/dev/null 2>&1; }

# The UDID of the first booted simulator, or empty.
booted_sim() {
  xcrun simctl list devices booted -j 2>/dev/null |
    python3 -c 'import json,sys
d=json.load(sys.stdin)["devices"]
print(next((x["udid"] for v in d.values() for x in v if x["state"]=="Booted"), ""))'
}

# Checks every repo needs before building for iOS.
doctor_ios() {
  note "Xcode and tools"
  need xcodebuild "Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app"
  need xcrun "Install Xcode command line tools."
  # `xcodebuild` exists with only the Command Line Tools selected, but then -version fails.
  # Read all of the output before taking a line: under pipefail, `head` closing early would fail the pipe.
  local version
  if ! version="$(xcodebuild -version 2>/dev/null)" || [[ -z "$version" ]]; then
    fail "xcodebuild cannot run (is only the Command Line Tools selected?). Run: sudo xcode-select -s /Applications/Xcode.app"
  fi
  ok "${version%%$'\n'*}"
  [[ "${LANG:-}" == en_US.UTF-8 && "${LC_ALL:-}" == en_US.UTF-8 ]] ||
    warn "LANG/LC_ALL are not en_US.UTF-8; pod install needs both (the just recipes set them)."
}
