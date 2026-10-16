#!/usr/bin/env bash
# Gives the e2e user something to look at: a few notes, so flows that open a note have one.
# Needs the scripted API running (just mobile e2e starts it). Safe to repeat: it only adds
# notes when the user has none.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
API_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:4040}"
ORIGIN="$API_URL"

cd "$REPO_DIR"
set -a; source services/api/.env.scripted; set +a
eval "$(E2E_ORIGIN="$ORIGIN" pnpm --filter @hominem/api --silent e2e:setup 2>/dev/null | grep -E '^[[:space:]]*export ')"
[[ -n "${E2E_SESSION_COOKIE:-}" ]] || { echo 'seed: could not sign the e2e user in' >&2; exit 1; }

api() { curl -fsS -H "Origin: $ORIGIN" -H "Content-Type: application/json" -H "Cookie: $E2E_SESSION_COOKIE" "$@"; }
count="$(api "$API_URL/api/inbox?kind=note" 2>/dev/null | jq 'if type=="object" then (.items // .data // [] | length) else length end' 2>/dev/null || echo 0)"
if [[ "$count" -gt 0 ]]; then echo "seed: the e2e user already has notes ($count)"; exit 0; fi
for title in 'Welcome to Omiro' 'Shopping list' 'Meeting notes'; do
  api -X POST "$API_URL/api/notes" -d "{\"title\":\"$title\",\"content\":\"Seeded for end-to-end tests: $title.\"}" >/dev/null
done
echo 'seed: added 3 notes for the e2e user'
