#!/usr/bin/env bash
# Fails on task-tracker incoherence: a tracked task (frontmatter with a
# status: key) must use a known status, and every depends_on / blocks entry
# must name an existing file in docs/tasks/ (with or without the .md suffix).
# Files without task frontmatter are design notes, not tracked tasks, and are
# excluded from ordering.
set -euo pipefail

TASKS_DIR="docs/tasks"
failures=0
tracked=0

fail() {
  echo "::error file=${1}::${2}" >&2
  failures=1
}

frontmatter_of() {
  awk 'NR==1 { if ($0 != "---") exit; next } $0 == "---" { exit } { print }' "$1"
}

entries_for() {
  printf '%s' "$1" | tr '\n' ' ' | sed -n "s/.*$2:[[:space:]]*\[\([^]]*\)\].*/\1/p" | tr ',' '\n' | sed "s/['\"]//g" | awk '{$1=$1};1' | grep -v '^$' || true
}

resolve_dep() {
  if [ -e "$TASKS_DIR/$1" ]; then
    printf '%s' "$1"
  elif [ -e "$TASKS_DIR/$1.md" ]; then
    printf '%s.md' "$1"
  else
    return 1
  fi
}

for f in "$TASKS_DIR"/*.md; do
  [ -e "$f" ] || continue
  frontmatter="$(frontmatter_of "$f")"
  status="$(printf '%s\n' "$frontmatter" | grep '^status:' | head -n 1 | cut -d: -f2- | tr -d "\"'" | awk '{$1=$1};1' || true)"
  if [ -z "$status" ]; then
    echo "note (no status, excluded from ordering): $f"
    continue
  fi
  tracked=$((tracked + 1))
  case "$status" in
    Proposed|Implemented|Blocked) ;;
    *) fail "$f" "unknown status '${status}' (expected Proposed, Implemented, or Blocked)" ;;
  esac
  for key in depends_on blocks; do
    while IFS= read -r entry; do
      [ -n "$entry" ] || continue
      if ! resolved="$(resolve_dep "$entry")"; then
        fail "$f" "${key} entry '${entry}' does not name an existing file in ${TASKS_DIR}/"
      fi
    done < <(entries_for "$frontmatter" "$key")
  done
done

if [ "$failures" -ne 0 ]; then
  echo "Found task frontmatter errors. Fix the status or edge, or reconcile the task record first." >&2
  exit 1
fi
echo "task frontmatter OK: ${tracked} tracked tasks"
