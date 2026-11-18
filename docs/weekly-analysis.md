# Weekly platform analysis

`just analysis weekly` runs a programmatic health pass over the platform and writes a
timestamped report. Run it once a week, or after a large batch of changes, to see where the
code is against the plans and how the API is performing.

```bash
just analysis weekly                 # finance-plan, codebase, API latency
just analysis weekly --full          # also typecheck and web build timings (slow)
just analysis weekly --skip-perf     # no API probe (API not running)
just analysis weekly --load          # adds the concurrent load test and security probes
just analysis weekly --load --gate   # same, exits 1 when a budget or probe fails
just analysis load                   # only the load test (skips the latency probe)
just analysis test                   # tests for the analysis suite itself (node:test)
just analysis history                # benchmark trend from the committed history
just analysis weekly --no-history    # run without appending to the history
```

Output goes to `scripts/analysis/reports/<timestamp>.md` and `.json`. The directory is
gitignored. Each report diffs against the previous JSON, so the trend builds over time.

## What each section measures

- **Finance plan** (`scripts/analysis/checks/finance-plan.mjs`). Each check encodes one claim
  from [finance-multi-currency-redesign-plan.md](finance-multi-currency-redesign-plan.md).
  `current` checks say whether the doc's description of today's code still holds. A
  `changed` status means the code moved and the doc needs an update. It is not a test
  failure. `target` checks track build-out: `open` becomes `done` as the plan lands.
  When you change a claim in the plan, change its check in the same commit.
- **Codebase** (`checks/codebase.mjs`). Source LOC, test files and cases, endpoint and MCP
  tool counts, migration count, debt markers (`any`, `as never`, `as unknown as`, TODO),
  and git state (branch, HEAD, dirty files). Endpoint, test, and tool counts are text
  patterns, not an AST, so treat them as approximate.
- **API latency** (`checks/api-latency.mjs`). Sequential p50, p95, and p99 for public
  endpoints (`/healthz`, `/api/status`). Authenticated finance endpoints run only when
  `ANALYSIS_SESSION_COOKIE` is set, so a 401 never reads as latency. Sequential requests
  show per-request latency, not throughput under load.
- **Load** (`checks/load.mjs`, `--load` only). Each scenario runs at several concurrency
  levels (default 1, 10, 25) with a 1s warmup thrown away. Reports rps, p50/p95/p99, and
  the status mix. Budgets are ceilings: p95 is checked at one level (default 10), and the
  error rate is checked at every level. An error is a network failure or a status the
  scenario did not expect. An unauthenticated route that returns 200 counts as an error.
  Probes send malformed, oversized, and forged requests in parallel. Each must get the
  expected 4xx, with no 5xx and no 200. A network reset counts as a failure, since the
  client never gets a status. The probe output records the error code.
- **Build** (`checks/build-timings.mjs`, `--full` only). Times the real `typecheck` and
  `build` commands and measures `apps/web/build/client`. A failed command, or a pnpm
  filter that matches no package, is recorded as a failure.

## Reading the numbers

- Counts are working-tree counts, uncommitted changes included. The git line in each
  report says how dirty the tree was when the run happened.
- Latency deltas are only meaningful between runs on the same machine, with the same
  `ANALYSIS_SAMPLES`, and with the API in the same state.
- The suite exits non-zero when a `--full` build step fails. With `--gate`, it also exits
  non-zero on a load budget or probe failure, or when the load run cannot reach the API.
  Drift in the finance plan is reported, not treated as a failure.
- Budgets in `checks/load.mjs` (`SCENARIOS`) are starting guesses from one local run.
  Tighten them after a few weeks of data, not before.

## Environment

- `ANALYSIS_API_URL` (default `http://localhost:4040`)
- `ANALYSIS_SAMPLES` (default 50 per endpoint)
- `ANALYSIS_SESSION_COOKIE` (optional, for the authenticated finance endpoints; use a
  test-account session from the `hominem-auth-e2e` flow, never a personal account)
- `ANALYSIS_LOAD_CONCURRENCY` (default `1,10,25`), `ANALYSIS_LOAD_SECONDS` (default 10),
  `ANALYSIS_LOAD_BUDGET_AT` (default 10)

## Benchmark history

Every run that measured something (API latency, load, or build timings) appends one JSON
line to `scripts/analysis/history/benchmarks.jsonl`. That file is committed, so the trend
survives a laptop wipe. Full reports stay in `reports/` and are gitignored.

Each line keeps the commit (`head`, `branch`), how dirty the tree was (`dirty`), latency
percentiles per endpoint, load percentiles and rps per scenario and level, the probes that
failed, and build timings. Raw status counts are dropped to keep the file small.

Read it with `just analysis history` (or `just analysis history 50` for more rows). Read the
`dirty` column before trusting a row: numbers taken on an uncommitted tree are a weaker
baseline.

Commit the history file with the change that moved the numbers, or on its own. It is
append-only, so a merge conflict means two runs happened at once. Keep both lines.

## Testing the suite

`just analysis test` runs `scripts/analysis/test/*.test.mjs` with Node's built-in
`node:test`. The load tests run against a local stub server (`test/stub-server.mjs`) that
fails in known ways: a flaky 500, a leaking 200 on a 401-only route, and a missing route.
That proves the runner flags them, instead of trusting the runner. No new dependencies.

## Known findings

- Under concurrency, some requests the API rejects with 401 or 413 come back as socket
  resets (`UND_ERR_SOCKET` / `ECONNRESET`), so the client never reads the status. The
  likely cause is the server answering before it drains the request body, then closing
  the connection. Not yet confirmed. The probe fails on it on purpose.
