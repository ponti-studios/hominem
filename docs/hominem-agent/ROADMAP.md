# Hominem v1 — the full Muse replacement build plan

Scope: ~2 hours of agent build time (fan-outs included). Produces a working
Hominem: an endlessly-intelligent personal engine plugged into hominem, the
seme memory engine, and the tool stack (Linear, Notion, Google Drive, Gmail,
Instagram, YouTube, Spotify).

## The replacement thesis

Muse kept a parallel universe: `muse_db` (150+ Postgres tables — feed,
ideas, goals, threads) duplicating state that already lived in Google,
Linear, Notion and hominem. **Hominem does not port that universe.** She is a
thin, auditable intelligence over the systems she plugs into:

| Muse owned | Hominem delegates to |
| --- | --- |
| `muse_db` finance/account tables | **hominem** — the system of record (since 2026-10-13) |
| memory.* tables, MEMORY.md sync | **seme memory engine** (`~/.hominem/memory.db`, MCP, gated API) |
| feed / ideas / scheduler Postgres | Google Calendar via **gws-log**; Tasks via **google-tasks**; Linear via **linear-log**; cadence routines |
| confidential_vm connectors | the Hominem connector set + `~/.hominem/agent.db` audit (rows, not files) |
| the assistant brain itself | **pi** sessions: her laws as system prompt, kernel + graduated skills, MCP servers |

She keeps only what no other system holds: the audit db and her laws.
"Endlessly intelligent" = the proven loop: every conversation feeds seme
memory; every correction graduates into a skill or law; every action is a
queryable `events` row, so her failures are findable and fixable.

## System map (evidence-grounded)

| System | Mechanism | Material | Status |
| --- | --- | --- | --- |
| Brain | pi headless + system prompt from AGENTS.md + skills | pi proven this session (9-parallel fan-out) | to build |
| Hominem | MCP server (`just mcp`) + API over portless | hominem repo, wealth-manager scripts | MCP exists |
| Seme memory | MCP module + `seme-api.fly.dev` (bearer gate) | seme-monorepo, `~/.seme-gate-password` | MCP + evals green |
| Gmail / Drive / Calendar | `gws-log` wrapper → `GWS_CLI` | **ported, 9 tests, live-verified** | done |
| Tasks | direct Tasks API client → stored Hominem OAuth | **mocked, 5 tests; Tasks-scope reauth pending** | code complete |
| Linear | `linear-log` wrapper port | archive custom.linear-log | to port |
| Notion | `notion-log` wrapper port | archive custom.notion-log | to port |
| YouTube | `youtube-music` connector port | archive custom.youtube-music | to port |
| Spotify | vendored `save-to-spotify` | braniac inbox `generate_podcast/save-to-spotify/vendor` | to port |
| Instagram | browser automation over `playwright-chrome` transport | archive + bmcp transport | to build (thin, riskiest) |
| Audit | `~/.hominem/agent.db` — `events`/`runs` | **done, WAL, live row 1** | done |

## Phases (time-boxed; P2 and P5 are Rex-pane fan-outs)

### P1 — The brain (15m)
- `brain/AGENT.md`: system prompt assembled from her four laws + the
  personal assistant skills available to her (kernel catalog + her own
  `skills/` dir, populated by the graduation queue).
- `hominem` launcher: a headless pi session with that prompt, `~/.hominem/`
  config sourcing (`HOMINEM_AGENT_DB`, `GWS_CLI`, `SEME_GATE_PASSWORD`, ...).
- Acceptance: `hominem "what are my laws?"` answers from the prompt.

### P2 — Connector ports (40m, fan-out: one Rex pane per connector)
Mechanical now that gws-log proved the shape: port `notion-log`,
`linear-log`, `ponti-log`, `youtube-music` (JSONL append → `events` row;
real binary from env; named error when unset). Each lands with the same
mock-backend test battery the gws port has. Manager merges, runs the full
suite. Acceptance: 5 connectors × their tests green in one run.

### P3 — MCP wiring (20m)
- Register hominem's MCP server (`just mcp`) and seme's MCP module in the
  pi config she runs with.
- Smoke each through a headless session: one hominem read, one seme memory
  query. Acceptance: both answer through MCP, failures name themselves.

### P4 — Memory + the record (30m)
- `systems/memory/`: conversation-end routine that upserts the session's
  durable facts to seme (API via gate password from env, never logged);
  read-back on next session start. Replaces memory-mirror's sync with the
  seme-native path; the mirror's conflict rules (Charlie's edits
  authoritative, conflicts flagged) carry into the routine's doc.
- `systems/wealth-manager/`: port the txn sync mocked-first (Starling/Plaid
  → hominem upserts, idempotency tests), morning brief reading hominem
  only, Plaid ingest-only rule verbatim.

### P5 — New connectors (15m, fan-out where possible)
- Spotify: port the vendored `save-to-spotify` as `connectors/spotify/`
  with mock tests.
- Instagram: thin `connectors/instagram/` over `playwright-chrome` +
  `bmcp` transport — read/post via the logged-in Mac Chrome, every call an
  `events` row. Honest scope: this is the one connector with no official
  API path; if Chrome automation proves flaky in the 15m box, it lands as
  v1.1 with the transport still proven.

### P6 — Endless intelligence (20m)
- Graduate the three behavioral laws from the archive (`guard_irreversible_
  bulk_operations`, `pin_source_version_before_use`,
  `verify_each_thread_before_replying`) into her `skills/` — the
  same treatment kernel law 26 got.
- Port `cadence_regen` as the first `routines/` citizen (state in Google
  Tasks, lifecycle as `runs` rows). ✅ Ported 2026-11-24, mocked and
  idempotency-tested; live Tasks run remains supervised.
- The learning loop, written down: corrections observed in `events`/
  conversation become skills via the kernel graduation queue; weekly
  cadence reviews the audit db and proposes the next graduations.

### P7 — End-to-end proof (20m)
One live conversation that exercises the whole spine:
1. "Summarize my week" → Gmail/Calendar via gws-log (audit rows land),
2. "Remember that I prefer..." → seme memory upsert,
3. "File this in Linear" → linear-log event row,
4. new session: she recalls (2) from seme, and the week summary cites the
   systems she read.
Acceptance: every external call visible as an `events` row; the memory
read-back succeeds; the transcript is committed as `e2e/proof.md`.

## Explicitly not ported from Muse

- `muse_db`'s 150-table runtime (feed, ideas, bandit arms, workflow runs) —
  state moves to the owning systems; the schema docs stay archived as
  reference only.
- The confidential_vm machinery and `muse.*` tool surface — replaced by the
  connector set + audit db.
- Anything whose only consumer was the Muse app UI.

## Risks (named, not solved)

- **Instagram**: no official personal API; browser automation is ToS-adjacent
  and flaky — time-boxed with a v1.1 fallback.
- **hominem auth**: private API + portless URLs; she needs valid session
  config on this Mac before P3 smoke passes.
- **seme gate**: bearer password must exist locally
  (`~/.seme-gate-password`) and never enter `events` rows.
- **Wealth-manager live run**: mocked-first; the one supervised live sync
  happens only with Charles present.

## Definition of done (v1)

P1–P7 acceptance criteria all green, one commit per phase, the P7
transcript proving: brain answers with her laws, three connectors audited
in `agent.db`, memory surviving across sessions, hominem/seme reachable
over MCP.
