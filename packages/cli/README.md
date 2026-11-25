# @hominem/cli

The `hominem` command provides Google auth and a finance adapter backed by the
Hominem API.

## Setup

Needs [bun](https://bun.sh) to compile the binary.

```bash
pnpm --filter @hominem/cli build
pnpm --filter @hominem/cli install:local
```

The token and OAuth client live in `$HOMINEM_HOME` (default `~/.hominem`):

- `google_client_secret.json` — the Desktop OAuth client (`installed` block)
- `google_token.json` — written by `hominem auth google`
- `hominem_oauth.json` — OAuth tokens written by `hominem auth hominem` (0600)

For finance, set `HOMINEM_API_URL` to the API origin (defaults to the
production API), then run `hominem auth hominem`. The command opens the hosted
login and requests finance read/write access. `STARLING_API_TOKEN` and Plaid
credentials stay on the machine and are sent only to their providers. The
adapter also reads `$HOMINEM_AGENT_ENV_FILE`, or `$HOMINEM_HOME/env` by default;
already-exported environment values take precedence. `WEALTH_SEED_DOCTRINE`
optionally names a local JSON doctrine file.

## Commands

| Command                                                                    | What it does                                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hominem auth google`                                                      | Opens Google sign-in, saves the token (atomic write, 0600), and syncs the rclone `gdrive` remote                                                           |
| `hominem auth hominem`                                                     | Signs in to Hominem with OAuth and stores a private refresh token                                                                                          |
| `hominem auth check [--notify]`                                            | Live check (refresh + one Drive call). Exit 0 healthy, 1 dead (needs `auth google` again), 2 couldn't check (offline or Google hiccup). Only dead notifies |
| `hominem auth sync-rclone`                                                 | Writes the current token into the rclone remote by editing `rclone.conf` directly (no secrets in process args)                                             |
| `hominem agent install`                                                    | Installs the daily 09:00 `auth check --notify` launch agent                                                                                                |
| `hominem agent uninstall`                                                  | Removes it                                                                                                                                                 |
| `hominem wealth seed`                                                      | Provision Starling account identities and optionally import the local doctrine                                                                             |
| `hominem wealth sync [--from YYYY-MM-DD] [--until YYYY-MM-DD] [--dry-run]` | Send raw provider feeds to the server for settled-transaction routing, classification, and import                                                          |
| `hominem wealth balances`                                                  | Show live Starling balances and Spaces, grouped by currency                                                                                                |
| `hominem wealth brief`                                                     | Morning brief; keeps the bill snapshot locally (`WEALTH_BRIEF_BILLS_ONLY`, `WEALTH_BRIEF_NO_WRITE_SNAPSHOT`)                                               |
| `hominem wealth look`                                                      | Forward look from `forward_look_inputs.json` and a live rate from `WEALTH_FX_URL` (Frankfurter by default)                                                 |
| `hominem wealth close`                                                     | Monthly close markdown from `monthly_close_anchors.json` and the month's check cache (`WEALTH_CLOSE_MONTH`, `WEALTH_CLOSE_OUT`)                            |
| `hominem wealth integrity`                                                 | Integrity flags from the sync checkpoint, `manual_anchors.json`, `cancellation_watches.json`, and live Plaid and Starling reads                            |

Sync checkpoints, held rows, and content-free run summaries are kept in
`$HOMINEM_AGENT_WEALTH_DIR` or `$HOMINEM_HOME/wealth`, scoped to the OAuth
client. Existing unscoped checkpoints and `pending_unmapped.json` are not
silently assigned to an account. A fresh client starts with a seven-day
window; use `--from` for an intentional historical replay. Held rows are
retained locally and the checkpoint is rewound so they can be retried after
account mapping.

Report math runs on the server. The CLI reads and writes only its local
inputs, the per-client bill snapshot, and the optional close file. It also
fetches provider and rate data. `WEALTH_SYNC_TODAY` pins the report date.

The launch agent must point at the compiled binary: macOS lists background items by executable name, so a `bun`/`node` path would show up as "node" instead of Hominem. `agent install` refuses to run from anything other than `hominem`.

## Development

```bash
pnpm --filter @hominem/cli dev -- auth check   # run from source with bun
pnpm --filter @hominem/cli test
```

Code layout: decisions live in pure functions (`health.ts`, `callback.ts`, `rclone-config.ts`, `renderPlist` in `launchd.ts`, `isFresh`/`classifyRefreshFailure` in `google.ts`). Network, clock and token saving are injected via `Deps`, and `auth.ts`/`system.ts` are the thin IO shell.

The token file format matches the Python skill's `setup.py`, so the google-workspace skills keep working from the same token.
