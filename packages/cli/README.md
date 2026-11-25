# @hominem/cli

The `hominem` command is the Hominem control plane: Google auth, the
personal agent, connectors, memory, wealth routines, and the daily auth
health check.

## Setup

Needs [bun](https://bun.sh) to compile the binary.

```bash
pnpm --filter @hominem/cli build
pnpm --filter @hominem/cli install:local
```

The repository's `post-commit` hook reinstalls this binary after every
Hominem commit, so `~/.local/bin/hominem` always matches the just-committed
CLI. Run `scripts/install-git-hooks.sh` once after cloning if
`core.hooksPath` is not already `.githooks`.

The token and OAuth client live in `$HOMINEM_HOME` (default `~/.hominem`):

- `google_client_secret.json` — the Desktop OAuth client (`installed` block)
- `google_token.json` — written by `hominem auth google`

## Commands

| Command | What it does |
| --- | --- |
| `hominem auth google` | Opens Google sign-in, saves the token (atomic write, 0600), and syncs the rclone `gdrive` remote |
| `hominem auth check [--notify]` | Live check (refresh + one Drive call). Exit 0 healthy, 1 dead (needs `auth google` again), 2 couldn't check (offline or Google hiccup). Only dead notifies |
| `hominem auth sync-rclone` | Writes the current token into the rclone remote by editing `rclone.conf` directly (no secrets in process args) |
| `hominem agent install` | Installs the daily 09:00 `auth check --notify` launch agent |
| `hominem agent uninstall` | Removes it |
| `hominem chat "request"` | Runs the personal agent through Pi with audited MCP calls |
| `hominem remember` / `recall` | Writes and searches durable Seme memory |
| `hominem reflect` | Extracts durable facts from a transcript and verifies their upsert |
| `hominem wealth sync` | Runs the idempotent Starling/Plaid-to-Hominem sync |
| `hominem wealth brief\|look\|close` | Runs finance analysis over Hominem records |
| `hominem cadence weekly\|monthly` | Regenerates missing Google Tasks |
| `hominem tasks` / `gws` / `spotify` / `instagram` / `ytm` / `linear` / `notion` / `ponti` | Runs audited external connectors |
| `hominem knowledge validate <batch-dir>` | Validates extraction claim/file JSONL against a local body manifest |
| `hominem workflow status <run-id>` | Reads persistent workflow progress without rerunning workers |

The launch agent must point at the compiled binary: macOS lists background items by executable name, so a `bun`/`node` path would show up as "node" instead of Hominem. `agent install` refuses to run from anything other than `hominem`.

## Development

```bash
pnpm --filter @hominem/cli dev -- auth check   # run from source with bun
pnpm --filter @hominem/cli test
```

Code layout: existing CLI decisions live in pure functions
(`health.ts`, `callback.ts`, `rclone-config.ts`, `renderPlist` in
`launchd.ts`, `isFresh`/`classifyRefreshFailure` in `google.ts`).
`src/agent/` holds the personal-agent command graph, connectors, memory,
wealth routines, and the built-in SQLite audit layer. Network, clock,
and token saving are injected where the owning surface already does so.

The token file format matches the Python skill's `setup.py`, so the google-workspace skills keep working from the same token.
