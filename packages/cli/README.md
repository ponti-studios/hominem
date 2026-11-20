# @hominem/cli

The `hominem` command: Google sign-in for the Hominem token, a live token check, and the daily auth check that runs under launchd.

## Setup

Needs [bun](https://bun.sh) to compile the binary.

```bash
pnpm --filter @hominem/cli build
pnpm --filter @hominem/cli install:local
```

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

The launch agent must point at the compiled binary: macOS lists background items by executable name, so a `bun`/`node` path would show up as "node" instead of Hominem. `agent install` refuses to run from anything other than `hominem`.

## Development

```bash
pnpm --filter @hominem/cli dev -- auth check   # run from source with bun
pnpm --filter @hominem/cli test
```

Code layout: decisions live in pure functions (`health.ts`, `callback.ts`, `rclone-config.ts`, `renderPlist` in `launchd.ts`, `isFresh`/`classifyRefreshFailure` in `google.ts`). Network, clock and token saving are injected via `Deps`, and `auth.ts`/`system.ts` are the thin IO shell.

The token file format matches the Python skill's `setup.py`, so the google-workspace skills keep working from the same token.
