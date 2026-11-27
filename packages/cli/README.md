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

To test drive a checkout against both servers, run
`pnpm --filter @hominem/cli install:profiles`. It builds once and installs
`hominem-local` (this checkout's local API, home `~/.hominem-local`, no bank
credentials from your shell) and `hominem-prod` (production API, home
`~/.hominem`, real data). Both run their own copy of the build, so re-run the
script after code changes. Run it from another worktree, or set
`HOMINEM_LOCAL_API_URL`, to repoint the local one.

The token and OAuth client live in `$HOMINEM_HOME` (default `~/.hominem`):

- `google_client_secret.json` — the Desktop OAuth client (`installed` block)
- `google_token.json` — written by `hominem auth google`
- `hominem_oauth.json` — OAuth tokens written by `hominem auth` (0600)

For finance, run `hominem auth`. It uses the production API unless
`HOMINEM_API_URL` says otherwise; if that address doesn't work, it asks for
one that does and saves it for you. It then opens the hosted login and
requests finance read/write access. `STARLING_API_TOKEN` and Plaid
credentials stay on the machine and are sent only to their providers. The
adapter also reads `$HOMINEM_AGENT_ENV_FILE`, or `$HOMINEM_HOME/env` by default;
already-exported environment values take precedence. `WEALTH_SEED_DOCTRINE`
optionally names a local JSON doctrine file.

## Commands

| Command                                                                                       | What it does                                                                                                                                               |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hominem auth google`                                                                         | Opens Google sign-in, saves the token (atomic write, 0600), and syncs the rclone `gdrive` remote                                                           |
| `hominem auth`                                                                                | Signs in to Hominem with OAuth and stores a private refresh token                                                                                          |
| `hominem auth check [--notify]`                                                               | Live check (refresh + one Drive call). Exit 0 healthy, 1 dead (needs `auth google` again), 2 couldn't check (offline or Google hiccup). Only dead notifies |
| `hominem auth sync-rclone`                                                                    | Writes the current token into the rclone remote by editing `rclone.conf` directly (no secrets in process args)                                             |
| `hominem agent install`                                                                       | Installs the daily 09:00 `auth check --notify` launch agent                                                                                                |
| `hominem agent uninstall`                                                                     | Removes it                                                                                                                                                 |
| `hominem wealth seed`                                                                         | Provision Starling account identities and optionally import the local doctrine                                                                             |
| `hominem finance sync [--bank starling] [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]` | Add new bank transactions; stored ones are never rewritten or duplicated                                                                                   |
| `hominem wealth sync [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]`                    | Send raw provider feeds to the server for settled-transaction routing, classification, and import                                                          |
| `hominem wealth balances`                                                                     | Show live Starling balances and Spaces, grouped by currency                                                                                                |
| `hominem wealth brief`                                                                        | Morning brief; keeps the bill snapshot locally (`WEALTH_BRIEF_BILLS_ONLY`, `WEALTH_BRIEF_NO_WRITE_SNAPSHOT`)                                               |
| `hominem wealth look`                                                                         | Forward look from `forward_look_inputs.json` and a live rate from `WEALTH_FX_URL` (Frankfurter by default)                                                 |
| `hominem wealth close`                                                                        | Monthly close markdown from `monthly_close_anchors.json` and the month's check cache (`WEALTH_CLOSE_MONTH`, `WEALTH_CLOSE_OUT`)                            |
| `hominem wealth integrity`                                                                    | Integrity flags from the sync checkpoint, `manual_anchors.json`, `cancellation_watches.json`, and live Plaid and Starling reads                            |
| `hominem chat "request"`                                                                      | Runs the personal agent through Pi with audited MCP calls                                                                                                  |
| `hominem remember` / `recall`                                                                 | Writes and searches durable Seme memory                                                                                                                    |
| `hominem reflect`                                                                             | Extracts durable facts from a transcript and verifies their upsert                                                                                         |
| `hominem cadence weekly\|monthly`                                                             | Regenerates missing Google Tasks                                                                                                                           |
| `hominem tasks` / `gws` / `spotify` / `instagram` / `ytm` / `linear` / `notion` / `ponti`     | Runs audited external connectors                                                                                                                           |
| `hominem knowledge validate [batch-dir]`                                                      | Selects a nearby extraction batch when omitted, then validates its JSONL                                                                                   |
| `hominem workflow status [run-id]`                                                            | Selects a recent workflow run when omitted, then reads its persisted progress                                                                              |
| `hominem calendar analyze [--start] [--end] [--no-pull] [--json]`                             | Reads the primary calendar; human summary by default, stable machine envelope with `--json`                                                                |
| `hominem studio nameplate`                                                                    | Renders deterministic diamond nameplates with platinum or gold presets                                                                                     |

Sync checkpoints, held rows, and content-free run summaries are kept in
`$HOMINEM_AGENT_WEALTH_DIR` or `$HOMINEM_HOME/wealth`, scoped to the API and
the signed-in user, so signing in again keeps them. Files saved under older
names are renamed on first use and the command says so on stderr. The unscoped
`hominem_sync_state.json`, `pending_unmapped.json`, and
`morning_brief_bills.json` are only claimed when signed in to
`https://api.ponti.io`. A fresh account starts with a seven-day window; use
`--from` for an intentional historical replay. Held rows are
retained locally and the checkpoint is rewound so they can be retried after
account mapping.

Report math runs on the server. The CLI reads and writes only its local
inputs, the per-account bill snapshot, and the optional close file. It also
fetches provider and rate data. `WEALTH_SYNC_TODAY` pins the report date.

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
