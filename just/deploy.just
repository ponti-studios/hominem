railway service config:
    #!/usr/bin/env bash
    case "{{ service }}" in api|career|workers) ;; *) echo "error: unknown Railway service '{{ service }}'" >&2; exit 1 ;; esac
    [[ -f "{{ justfile_directory() }}/{{ config }}" ]] || { echo "error: Railway config not found: {{ config }}" >&2; exit 1; }
    [[ -n "${SERVICE:-}" ]] || { echo 'error: SERVICE must be set' >&2; exit 1; }
    [[ -n "${RAILWAY_TOKEN:-}" ]] || { echo 'error: RAILWAY_TOKEN must be set' >&2; exit 1; }
    [[ ! -e "{{ justfile_directory() }}/railway.json" ]] || { echo 'error: railway.json already exists at the repository root' >&2; exit 1; }
    cp "{{ justfile_directory() }}/{{ config }}" "{{ justfile_directory() }}/railway.json"
    trap 'rm -f "{{ justfile_directory() }}/railway.json"' EXIT
    cd "{{ justfile_directory() }}"
    set +e
    pnpm exec railway up --ci --no-gitignore --service "$SERVICE" 2>&1 | tee /tmp/railway-up.log
    status=${PIPESTATUS[0]}
    set -e
    if [[ "$status" -ne 0 ]]; then
      grep -Eo 'https://railway\.com/project/[^[:space:]]+' /tmp/railway-up.log | tail -n 1 | sed 's/^/Railway build logs: /' >&2 || true
      tail -n 80 /tmp/railway-up.log || true
      exit "$status"
    fi
