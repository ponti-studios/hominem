#!/usr/bin/env bash
# Installs the studio shipping runtime from this skill into a repo.
# The runtime must resolve inside the repo (it reads $ROOT, runs just
# recipes, signs builds), so each repo holds it under .studio/ — as
# symlinks to this skill, the canonical source. Copies are not accepted:
# a real file where a link belongs is drift.
#
# Usage:
#   scripts/install.sh [--check] <repo-root>...
#
# Install links ship-ios.sh + lib.sh + VERSION into <repo>/.studio/.
# --check exits 1 when any entry is missing, a copy, or points elsewhere.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK=0
if [[ "${1:-}" == "--check" ]]; then CHECK=1; shift; fi

if [[ $# -eq 0 ]]; then
  echo "usage: install.sh [--check] <repo-root>..." >&2
  exit 2
fi

fail=0

for repo in "$@"; do
  dest="$repo/.studio"
  for f in ship-ios.sh lib.sh; do
    canon="$HERE/$f"
    link="$dest/$f"
    if [[ ! -e "$canon" ]]; then
      echo "MISSING canonical: $canon"
      fail=1
      continue
    fi
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

if [[ $CHECK == 1 && $fail == 1 ]]; then
  echo "install.sh --check FAILED" >&2
  exit 1
fi
[[ $CHECK == 1 ]] && echo "ship runtime resolves via skill"
exit "$fail"
