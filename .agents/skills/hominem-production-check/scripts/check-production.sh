#!/usr/bin/env bash
set -euo pipefail

while (($#)); do
  case "$1" in
    -h|--help) printf 'Usage: %s\n' "$0"; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

command -v fly >/dev/null || { echo 'fly CLI is required' >&2; exit 2; }
command -v jq >/dev/null || { echo 'jq is required' >&2; exit 2; }
command -v curl >/dev/null || { echo 'curl is required' >&2; exit 2; }

echo "Production check: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo 'Platform: Fly.io (region sjc)'
echo
echo 'FLY MACHINES'
printf '%-18s %-16s %-10s %-10s\n' app machine state checks

failed=0
for app in hominem-api hominem-worker hominem-web hominem-career hominem-finance hominem-redis hominem-db; do
  if ! machines=$(fly machine list --app "$app" --json 2>/dev/null); then
    printf '%-18s %-16s %-10s %-10s\n' "$app" '-' 'ERR' 'fly failed'
    failed=1
    continue
  fi
  rows=$(jq -r '.[] | [.id, .state, ((.checks // []) | map(.status) | unique | join(",") | if . == "" then "none" else . end)] | @tsv' <<<"$machines")
  if [[ -z "$rows" ]]; then
    printf '%-18s %-16s %-10s %-10s\n' "$app" '-' 'NONE' '-'
    failed=1
    continue
  fi
  while IFS=$'\t' read -r id state checks; do
    printf '%-18s %-16s %-10s %-10s\n' "$app" "$id" "$state" "$checks"
    [[ "$state" == started ]] || failed=1
    [[ "$checks" == none || "$checks" == passing ]] || failed=1
  done <<<"$rows"
done

echo
echo 'PUBLIC DOMAINS'
printf '%-22s %-6s %-52s\n' domain code location

strict=1
check_domain() {
  local host=$1 expected_code=$2 expected_location=$3 headers code location failed_before=$failed
  headers=$(curl -sS -D - -o /dev/null --max-time 15 --max-redirs 0 "https://$host/" 2>/dev/null || true)
  code=$(awk '/^HTTP\//{value=$2} END{print value}' <<<"$headers")
  location=$(awk 'tolower($0) ~ /^location:/{print substr($0,11)}' <<<"$headers" | tr -d '\r')
  printf '%-22s %-6s %-52s\n' "$host" "${code:-ERR}" "${location:-—}"
  if [[ "$code" != "$expected_code" ]]; then
    failed=1
  else
    case "$expected_location" in
      '') [[ -z "$location" ]] || failed=1 ;;
      exact:*) [[ "$location" == "${expected_location#exact:}" ]] || failed=1 ;;
      prefix:*) [[ "$location" == "${expected_location#prefix:}"* ]] || failed=1 ;;
    esac
  fi
  # Domains that don't live on Fly are reported but never fail the run.
  if ((!strict && failed != failed_before)); then
    failed=$failed_before
    echo "  ^ WARN: unexpected response for $host (not a Fly app, not counted)"
  fi
}

check_domain api.ponti.io 200 ''
check_domain career.ponti.io 200 ''
check_domain finance.ponti.io 200 ''
check_domain omiro.ponti.io 302 'prefix:https://api.ponti.io/login?'

# Not Fly apps from this repo (labs was still answering via Railway on 2026-10-23).
strict=0
check_domain labs.ponti.io 200 ''
check_domain ponti.io 200 ''
check_domain newsboy.ponti.io 302 'exact:/reality'

echo
if ((failed)); then
  echo 'RESULT: FAIL'
  exit 1
fi
echo 'RESULT: PASS'
