# Hominem personal agent architecture

The personal agent is part of `@hominem/cli`. There is no second runtime, launcher, dependency graph, or OAuth store.

## Ownership

| Concern | Owner |
| --- | --- |
| Compiled command surface | `packages/cli` |
| Google sign-in and token storage | `packages/cli/src/google.ts` / `hominem auth google` |
| Finance and generated records | Hominem API and MCP |
| Durable conversational memory | Seme MCP |
| Personal automation, connectors, and command routing | `packages/cli/src/agent` |
| Audit history and routine state | `~/.hominem/agent.db` |
| Machine-local agent inputs | `~/.hominem/env` and `~/.hominem/wealth` |
| Muse source archive | `archive/2026-11-21` (gitignored, never committed) |

## Command graph

The compiled `hominem` binary routes personal-agent commands directly to
imported TypeScript modules:

```text
hominem
  chat / remember / recall / reflect
  wealth sync|integrity|brief|look|close|balances|seed
  cadence weekly|monthly
  tasks
  gws
  spotify
  instagram
  ytm
  linear
  notion
  ponti
```

Agent modules do not self-execute on import. `src/index.ts` is the only
production entrypoint, so the Bun-compiled binary cannot accidentally run
every imported connector at startup.

## Audit contract

Every external call writes one row to the `events` table. Every routine
writes one `runs` lifecycle row. `src/agent/log/agent_log.ts` is the only
SQLite schema and access owner. It uses built-in `node:sqlite`, opens WAL,
applies a busy timeout, and remains compatible with the existing event
and run shapes.

Default paths:

- audit database: `~/.hominem/agent.db`
- override: `HOMINEM_AGENT_DB`
- machine env: `~/.hominem/env`
- override: `HOMINEM_AGENT_ENV_FILE`
- wealth inputs/state: `~/.hominem/wealth`
- override: `HOMINEM_AGENT_WEALTH_DIR`

## Google

`hominem auth google` is the only Google OAuth flow. It owns PKCE, loopback
callback capture, atomic token replacement, rclone sync, and the shared
scope list. Google Tasks is included in that list.

The Tasks connector reads the shared `~/.hominem/google_token.json`,
delegates expired-token refresh to the Hominem Google module, and audits
each Tasks API request. It never records token values.

## Agent brain

`hominem chat` runs Pi headlessly with the bundled agent persona. MCP tool
calls are read from Pi's JSON event stream and written to `events`; the
brain's final reply is returned to the terminal.

`hominem reflect` is split deliberately:

1. Pi extracts durable facts as JSONL and makes no tool calls.
2. The deterministic memory routine recalls, deduplicates, saves, and
   verifies each fact through Seme.

This preserves judgment in the model and correctness in local code.

## Validation

Run:

```bash
pnpm --filter @hominem/cli format:check
pnpm --filter @hominem/cli lint
pnpm --filter @hominem/cli build
pnpm --filter @hominem/cli typecheck
pnpm --filter @hominem/cli test
```

The package test command runs both the Hominem Vitest suite and the
migrated agent regression suite.
