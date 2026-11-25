# Hominem personal agent runbook

## Install the one CLI

```bash
cd ~/Developer/hominem
pnpm --filter @hominem/cli install:local
```

Do not install or invoke a separate agent launcher.

## Google

```bash
hominem auth google
hominem tasks tasklists
```

The first command opens browser consent and now requests the Google Tasks
scope alongside the existing Workspace scopes. The second command is a
read-only read-back of the shared token.

## Agent

```bash
hominem chat "What should I focus on today?"
hominem remember "A durable fact"
hominem recall "search durable memory"
hominem reflect < transcript.txt
```

`reflect` accepts the transcript on stdin, extracts durable facts through
Pi, then performs the deterministic Seme recall/dedup/save/read-back flow.

## Wealth

```bash
hominem wealth sync
hominem wealth integrity
hominem wealth brief
hominem wealth look
hominem wealth close
hominem wealth balances
hominem wealth seed
```

Wealth data stays in Hominem. The CLI never keeps personal finance
records in the repository. Plaid remains ingest-only; analysis reads
Hominem.

### Plaid

```bash
hominem plaid status
hominem plaid auth
hominem plaid accounts
hominem plaid transactions --since 2026-11-20 --until 2026-11-25
hominem plaid liabilities
```

`hominem plaid auth` opens Plaid Link, exchanges the public token for an
access token, and stores the access token and Item ID in `~/.hominem/env`
with mode `600`. Plaid's client ID and secret do not enter command output
or audit event values.

## Cadences and connectors

```bash
hominem cadence weekly
hominem cadence monthly
hominem gws <service command...>
hominem spotify <command...>
hominem instagram <command...>
hominem ytm <command...>
hominem linear <command...>
hominem notion <command...>
hominem ponti <command...>
hominem knowledge validate [batch-dir] [bodies-dir]
hominem workflow status [run-id]
```

Cadence regeneration discovers the exact `Weekly Cadence` and
`Monthly Cadence` list IDs from the Google Tasks API. It creates only
missing open tasks, so rerunning it is safe.

## Calendar analysis

```bash
hominem calendar analyze --start 2026-11-26 --end 2026-11-26
hominem calendar analyze --no-pull
hominem calendar analyze --start 2026-11-26 --end 2026-11-26 --json
```

`calendar analyze` is read-only: it pulls only the primary calendar through
the logged GWS wrapper, caches events under
`~/.hominem/calendar/runs/<start>_to_<end>/`, and writes
`events-cache.json`, `report.json`, and `report.md`.

`--no-pull` reuses an existing cache. There are no calendar writes in this
command.

Without `--json`, output is an exception-led human summary. With `--json`,
stdout is a stable machine envelope containing counts, findings, source,
run id, and artifact paths; the full report remains in `report.json`.

`knowledge validate` expects `batch.json`, `claims.jsonl`,
`files.jsonl`, and a `bodies/` directory containing the manifest files.
It checks schemas, exact file coverage, sequential `fNN-NNN` IDs,
per-file claim counts, and verbatim `best_sentence` values.

The workflow runtime persists stable worker keys, attempts, results, and
failures in `~/.hominem/agent.db`. Resuming skips completed keys and
retries only pending or failed workers. `workflow status` is read-only.
When its ID is omitted, an interactive terminal presents recent runs.
`knowledge validate` similarly discovers nearby `batch.json` directories.
Non-interactive shells print the available choices and exit without
guessing.

## Studio nameplates

```bash
hominem studio nameplate \
  --word DAKOTA \
  --font /path/to/AbrilFatface.ttf \
  --texture /path/to/diamond-texture.png \
  --preset gold \
  --output /path/to/dakota-gold.png \
  --preview /path/to/dakota-gold-preview.jpg
```

Presets are `platinum` and `gold`. The renderer is bundled into the
compiled CLI; its only external runtime dependency is Python with Pillow
13.0.0. Set `HOMINEM_PYTHON` when `python3` is not the intended interpreter.
The exact seed and dimensions make repeated renders deterministic.

The archived Abril scripts supplied the effect, but not the original font
and diamond texture. A live DAKOTA render remains blocked until those two
assets are restored from the `tshirt-designs/brand` workspace.

## Machine configuration

Create `~/.hominem/env` with the required connector variables. The file is
not committed. Values are loaded only into keys that are not already set
in the process environment.

```sh
export HOMINEM_AGENT_DB="$HOME/.hominem/agent.db"
export HOMINEM_AGENT_WEALTH_DIR="$HOME/.hominem/wealth"
export GWS_CLI="/path/to/google-workspace-cli"
export NOTION_CLI="/path/to/notion-cli"
export LINEAR_CLI="/path/to/linear-cli"
export PONTI_CLI="/path/to/ponti-mcp-client"
export YTM_CLI="/path/to/ytm-cli"
export IG_CLI="/path/to/ig-cli"
export SEME_MCP_CMD="node /path/to/seme-mcp-server.js"
export PLAID_CLIENT_ID="your-plaid-client-id"
export PLAID_SECRET="your-plaid-development-secret"
export PLAID_ENV="development"
```

Google OAuth lives separately in:

- `~/.hominem/google_client_secret.json`
- `~/.hominem/google_token.json`

Missing configuration fails by variable name; paths are never guessed.

## Audit

```bash
sqlite3 ~/.hominem/agent.db \
  "SELECT connector, service, ok, http_status, duration_ms FROM events ORDER BY id DESC LIMIT 10;"

sqlite3 ~/.hominem/agent.db \
  "SELECT * FROM runs ORDER BY id DESC LIMIT 10;"
```

Querying the database replaces log-file grepping.

## Development gate

```bash
pnpm --filter @hominem/cli format
pnpm --filter @hominem/cli lint
pnpm --filter @hominem/cli build
pnpm --filter @hominem/cli typecheck
pnpm --filter @hominem/cli test
```

The package test script runs the existing Vitest suite plus all migrated
agent regression tests.
