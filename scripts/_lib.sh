#!/usr/bin/env bash
# Shared utilities for hominem scripts. Source this file; do not execute directly.
# Usage: source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_lib.sh"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COMPOSE_DEV=(docker compose -f "$ROOT_DIR/infra/docker/compose/base.yml" -f "$ROOT_DIR/infra/docker/compose/dev.yml")
COMPOSE_OBS=(docker compose -f "$ROOT_DIR/infra/docker/compose/observability.yml")

# wait_for_http <url> <max_attempts> [delay_secs=1]
# Polls <url> until it returns 2xx or <max_attempts> is exhausted.
wait_for_http() {
  local url="$1" max="$2" delay="${3:-1}" attempt=0
  while (( attempt < max )); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep "$delay"
    (( attempt++ ))
  done
  echo "ERROR: $url did not respond after $((max * delay))s" >&2
  return 1
}

# poll_clickhouse <url> <query> <max_attempts> [delay_secs=2]
# Polls a ClickHouse query until it returns non-empty rows.
# Prints rows to stdout on success; returns 1 on timeout.
poll_clickhouse() {
  local url="$1" query="$2" max="$3" delay="${4:-2}" attempt=0 rows=""
  while (( attempt < max )); do
    rows="$(curl -fsS --get --data-urlencode "query=${query}" "${url}/" 2>/dev/null || true)"
    if [ -n "$rows" ]; then
      printf '%s\n' "$rows"
      return 0
    fi
    sleep "$delay"
    (( attempt++ ))
  done
  return 1
}

# ensure_obs_stack — idempotently starts the observability stack
ensure_obs_stack() {
  echo "==> Starting observability stack..."
  "${COMPOSE_OBS[@]}" up -d --wait
}

# ensure_dev_infra [services...] — idempotently starts core dev services
# Defaults to redis and db.
ensure_dev_infra() {
  local services=("${@:-redis db}")
  echo "==> Starting dev infra: ${services[*]}"
  "${COMPOSE_DEV[@]}" up -d --no-build "${services[@]}"
}

# start_service_bg <name> <dir> <log_file> <pid_file> [env_key=val ...]
# Starts a bun process in the background with extra env vars.
start_service_bg() {
  local name="$1" dir="$2" log_file="$3" pid_file="$4"
  shift 4
  rm -f "$log_file" "$pid_file"
  echo "==> Starting $name..."
  (
    cd "$dir"
    env "$@" bun src/index.ts >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
}

# stop_service <name> <pid_file>
stop_service() {
  local name="$1" pid_file="$2"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}