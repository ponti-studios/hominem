#!/usr/bin/env bash
# Gives the e2e user something to look at: a few notes and chats, so flows that open one have one.
# Needs the scripted API running (just mobile e2e starts it). Safe to repeat: it only adds
# what is missing.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
API_URL="${EXPO_PUBLIC_API_BASE_URL:-http://localhost:4040}"
ORIGIN="$API_URL"

cd "$REPO_DIR"
set -a; source services/api/.env.scripted; set +a
eval "$(E2E_ORIGIN="$ORIGIN" pnpm --filter @hominem/api --silent e2e:setup 2>/dev/null | grep -E '^[[:space:]]*export ')"
[[ -n "${E2E_SESSION_COOKIE:-}" ]] || { echo 'seed: could not sign the e2e user in' >&2; exit 1; }

api() { curl -fsS -H "Origin: $ORIGIN" -H "Content-Type: application/json" -H "Cookie: $E2E_SESSION_COOKIE" "$@"; }
# There is no list-notes endpoint, so count notes in the scripted database (psql is a setup requirement).
note_count="$(PGOPTIONS='--client-min-messages=error' psql "$DATABASE_URL" -Atc "select count(*) from app.notes where owner_userid = '${E2E_USER_ID:-}'" 2>/dev/null || echo 0)"
chat_count="$(api "$API_URL/api/chats" 2>/dev/null | jq '.items | length' 2>/dev/null || echo 0)"

if [[ "$note_count" -gt 0 ]]; then
  echo "seed: the e2e user already has notes"
else
  for title in 'Welcome to Omiro' 'Shopping list' 'Meeting notes'; do
    api -X POST "$API_URL/api/notes" -d "{\"title\":\"$title\",\"content\":\"Seeded for end-to-end tests: $title.\"}" >/dev/null
  done
  echo 'seed: added 3 notes'
fi

if [[ "$chat_count" -gt 0 ]]; then
  echo "seed: the e2e user already has chats"
else
  for title in 'Planning the week' 'Trip ideas'; do
    api -X POST "$API_URL/api/chats" -d "{\"title\":\"$title\"}" >/dev/null
  done
  echo 'seed: added 2 chats'
fi
