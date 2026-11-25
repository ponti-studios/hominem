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
hominem knowledge validate <batch-dir> [bodies-dir]
hominem workflow status <run-id>
```

Cadence regeneration discovers the exact `Weekly Cadence` and
`Monthly Cadence` list IDs from the Google Tasks API. It creates only
missing open tasks, so rerunning it is safe.

`knowledge validate` expects `batch.json`, `claims.jsonl`,
`files.jsonl`, and a `bodies/` directory containing the manifest files.
It checks schemas, exact file coverage, sequential `fNN-NNN` IDs,
per-file claim counts, and verbatim `best_sentence` values.

The workflow runtime persists stable worker keys, attempts, results, and
failures in `~/.hominem/agent.db`. Resuming skips completed keys and
retries only pending or failed workers. `workflow status` is read-only.

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
