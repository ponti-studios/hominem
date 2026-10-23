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

# Promote the latest full run to the committed baselines (review the diff first).
baseline:
    pnpm --filter @hominem/ori eval baseline

# Score the judge model against the human-labeled calibration cases.
calibrate:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a; source '{{ ENV_FILE }}'; set +a
    pnpm --filter @hominem/ori eval calibrate

# Typecheck every suite, runner file and test.
typecheck:
    pnpm --filter @hominem/ori typecheck

# Run the offline unit tests for the runner, assertions and suite config.
test:
    pnpm --filter @hominem/ori test
