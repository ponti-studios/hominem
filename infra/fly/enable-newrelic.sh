#!/usr/bin/env bash
# Turns on OTLP export (traces, metrics, logs) to New Relic for api + worker.
# Reads NEW_RELIC_LICENSE_KEY / NEW_RELIC_OTLP_ENDPOINT from ~/hominem-fly.env.
# Secrets are piped over stdin, never printed.
set -euo pipefail
ENV_FILE="${1:-$HOME/hominem-fly.env}"
get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
KEY="$(get NEW_RELIC_LICENSE_KEY)"; EP="$(get NEW_RELIC_OTLP_ENDPOINT)"
[ -n "$KEY" ] || { echo "NEW_RELIC_LICENSE_KEY is empty in $ENV_FILE" >&2; exit 1; }
for app in hominem-api hominem-worker; do
  printf 'OTEL_EXPORTER_OTLP_ENDPOINT=%s\nOTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf\nOTEL_EXPORTER_OTLP_HEADERS=api-key=%s\nOTEL_DEPLOYMENT_ENVIRONMENT=production\n' "$EP" "$KEY" \
    | fly secrets import -a "$app"
done
