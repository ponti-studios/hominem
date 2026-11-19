ROOT_DIR := justfile_directory()
ENV_FILE := ROOT_DIR / "services/api/.env"

# Every recipe forwards to `pnpm --filter @hominem/ori eval`; the live ones load the API .env for the OpenRouter key.

# List suites, tiers, case counts and hashes (offline, free).
list:
    pnpm --filter @hominem/ori eval list

# Validate every suite and baseline without calling a model. This is what CI runs.
check:
    pnpm --filter @hominem/ori eval:check

# Run suites live and gate against baselines. Pass flags through, e.g. `just evals run --suite voice-cleanup --trials 3`.
run *args:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a; source '{{ ENV_FILE }}'; set +a
    pnpm --filter @hominem/ori eval run {{ args }}

# Run the live MCP suite end to end with no manual steps: reset a disposable eval account, mint a throwaway
# token, seed, run, then revoke on exit. Needs the local API up (default http://localhost:4040).
live *args:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a; source '{{ ENV_FILE }}'; set +a
    export HOMINEM_EVAL_API_URL="${HOMINEM_EVAL_API_URL:-http://localhost:4040}"
    export HOMINEM_EVAL_SEED_ACCOUNT=mcp-eval-e2e@test.hominem.dev
    if ! curl -fsS -m 5 -o /dev/null "$HOMINEM_EVAL_API_URL/healthz"; then
      echo "✗ API not reachable at $HOMINEM_EVAL_API_URL. Start it (pnpm dev) or set HOMINEM_EVAL_API_URL." >&2
      exit 1
    fi
    tokenfile="$(mktemp)"; chmod 600 "$tokenfile"
    cleanup() {
      pnpm --filter @hominem/api test-user revoke --email "$HOMINEM_EVAL_SEED_ACCOUNT" || true
      rm -f "$tokenfile"
    }
    trap cleanup EXIT
    # Fresh account every run: reset deletes it (and all its data) and creates it again.
    pnpm --filter @hominem/api test-user reset --email "$HOMINEM_EVAL_SEED_ACCOUNT"
    pnpm --filter @hominem/api test-user token --email "$HOMINEM_EVAL_SEED_ACCOUNT" \
      --env-file "$tokenfile" --var HOMINEM_EVAL_MCP_TOKEN
    set -a; source "$tokenfile"; set +a
    pnpm --filter @hominem/ori exec tsx evals/seed/seed-test-account.mts
    pnpm --filter @hominem/ori eval run --suite mcp-user-requests {{ args }}

# Promote the latest full run to the committed baselines (review the diff first).
baseline:
    pnpm --filter @hominem/ori eval baseline

# Score the judge model against the human-labeled calibration cases.
calibrate:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a; source '{{ ENV_FILE }}'; set +a
    pnpm --filter @hominem/ori eval calibrate

# Rebuild services/ori/ledger.csv from every run on disk (also done after each run) and show the recent ones.
ledger:
    pnpm --filter @hominem/ori eval ledger

# Typecheck every suite, runner file and test.
typecheck:
    pnpm --filter @hominem/ori typecheck

# Run the offline unit tests for the runner, assertions and suite config.
test:
    pnpm --filter @hominem/ori test
