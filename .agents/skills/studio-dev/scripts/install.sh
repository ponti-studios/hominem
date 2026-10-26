#!/usr/bin/env bash
# Assembles a repo's .studio/ from the kernel skills.
# The runtime must resolve inside the repo (it reads $ROOT, runs just
# recipes, signs builds), so each repo holds it under .studio/ — as
# symlinks to the skills, the canonical source. Copies are not accepted:
# a real file where a link belongs is drift.
#
# Usage:
#   scripts/install.sh [--check] <repo-root>...
#
# Installs links for studio.just, ports.env, STUDIO.md, VERSION, then
# chains the ship-ios skill installer for ship-ios.sh + lib.sh + VERSION.
# --check exits 1 when any entry drifts, for CI or a pre-ship sanity check.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(cd "$HERE/../.." && pwd)"
SHIP_INSTALL="$SKILLS_DIR/ship-ios/scripts/install.sh"
CHECK=0
if [[ "${1:-}" == "--check" ]]; then CHECK=1; shift; fi

if [[ $# -eq 0 ]]; then
  echo "usage: install.sh [--check] <repo-root>..." >&2
  exit 2
fi
[[ -x "$SHIP_INSTALL" ]] || { echo "missing ship runtime installer: $SHIP_INSTALL" >&2; exit 2; }

fail=0

for repo in "$@"; do
  dest="$repo/.studio"
  for f in studio.just ports.env STUDIO.md VERSION; do
    canon="$HERE/$f"
    link="$dest/$f"
    if [[ -L "$link" && "$(readlink "$link")" == "$canon" ]]; then
      [[ $CHECK == 1 ]] || echo "ok   $link"
      continue
    fi
    if [[ $CHECK == 1 ]]; then
      echo "DRIFT $link (want -> $canon)"
      fail=1
      continue
    fi
    mkdir -p "$dest"
    rm -f "$link"
    ln -s "$canon" "$link"
    echo "link $link -> $canon"
  done
done

# The shipping files live in the ship-ios skill; link/check them everywhere too.
if [[ $CHECK == 1 ]]; then
  "$SHIP_INSTALL" --check "$@" || fail=1
else
  "$SHIP_INSTALL" "$@" || exit "$?"
fi

if [[ $CHECK == 1 ]]; then
  if [[ $fail == 1 ]]; then echo "install.sh --check FAILED" >&2; exit 1; fi
  echo "all links resolve via skills"
fi
