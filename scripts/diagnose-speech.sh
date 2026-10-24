#!/usr/bin/env bash
set -euo pipefail

# Fly only keeps a short log buffer, so this looks at whatever is still in it.
echo "Speech diagnosis (Fly: hominem-api, hominem-worker)"
echo

show_logs() {
  local service="$1"
  echo "--- ${service} speech/reconciliation logs ---"
  "$(dirname "$0")/fly-logs.sh" "$service" --json \
    | jq -r '.message // empty' 2>/dev/null \
    | rg -i 'speech|reconcil|ai-usage|constraint|exception|error' || true
  echo
}

show_logs api
show_logs worker

echo "--- recent production failures ---"
"$(dirname "$0")/fly-logs.sh" api --json \
  | jq -r '.message // empty' 2>/dev/null \
  | rg -i 'error|exception|failed|unavailable' || true
echo

echo "--- current commit workflow status ---"
if command -v gh >/dev/null 2>&1 && git rev-parse --verify HEAD >/dev/null 2>&1; then
  gh run list --branch main --commit "$(git rev-parse HEAD)" --limit 20 \
    --json name,status,conclusion,url \
    --jq '.[] | [.name, .status, (.conclusion // ""), .url] | @tsv'
else
  echo 'gh or git is unavailable; skipped workflow status'
fi
