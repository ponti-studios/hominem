set dotenv-load := false

# Weekly platform analysis: finance-plan drift, codebase metrics, API latency.
# `just analysis weekly --full` also times typecheck and the web build. `--skip-perf`
# skips the API latency probe. `--load` adds the concurrent load test and probes;
# `--gate` makes a failed budget exit non-zero. Reports land in scripts/analysis/reports/.
weekly *flags:
    node "{{ justfile_directory() }}/scripts/analysis/weekly.mjs" {{ flags }}

# Concurrent load budgets and hostile-input probes against a running API.
load *flags:
    node "{{ justfile_directory() }}/scripts/analysis/weekly.mjs" --skip-perf --load {{ flags }}

# Benchmark trend from the committed history. `just analysis history 30` for more rows.
history *limit:
    node "{{ justfile_directory() }}/scripts/analysis/history.mjs" {{ limit }}

# Unit and integration tests for the analysis suite itself (node:test, no deps).
test:
    node --test "{{ justfile_directory() }}/scripts/analysis/test/"*.test.mjs
