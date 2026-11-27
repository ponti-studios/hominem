# Hominem engine conversion — deep analysis of the 2026-11-21 script archive

The engine is named **Hominem**. Her repo is `~/Developer/hominem`; her state
lives under `~/.hominem/`.

Source: the 2026-11-21 script archive, now machine-local at
`~/Developer/hominem/archive/2026-11-21/` (187 files,
6.5 MB) — salvage from the JARVIS/Muse workspace (`.jarvis/`, custom-skills,
custom-connectors, systems-live), harvested from two machines: the **hatch
Linux VM** (`/home/hatch/workspace/...`) and the **Mac**.

Method: full-category inventory, targeted reads of every category's
representative scripts, cross-checked against the kernel braniac inbox (55
skills) and existing kernel skills. Not every one of the 187 files was read;
every category was, and the verdicts below name their evidence.

## 1. The engine's discovered architecture

The archive is not a pile of scripts; it is the residue of a real personal
engine with four visible conventions. These conventions are the conversion
contract — preserve them or the engine stops being the engine.

1. **Every external action goes through a logging wrapper — and every log
   goes to `~/.hominem/agent.db`, not log files.** The connectors
   are not raw CLIs: `custom.gws-log`, `custom.notion-log`,
   `custom.linear-log`, `custom.ponti-log` wrap every Google/Notion/Linear
   call and record it. Scripts state it as doctrine: *"via the logging
   wrapper (never the raw notion-cli)"*. Conversion change (2026-11-22):
   the wrappers' per-service JSONL files are replaced by one SQLite audit
   database. The current JSONL field set maps field-for-field:

   ```sql
   -- every external call (replaces logs/*.jsonl)
   CREATE TABLE events (
     id INTEGER PRIMARY KEY,
     ts_request TEXT NOT NULL, ts_request_ms INTEGER NOT NULL,
     ts_response TEXT, ts_response_ms INTEGER,
     duration_ms INTEGER,
     connector TEXT NOT NULL,           -- gws, notion, linear, ponti, ...
     service TEXT,                     -- gmail, calendar, ... or NULL
     command TEXT NOT NULL,             -- full argv
     params TEXT, json_body TEXT,      -- JSON-encoded request payloads
     response TEXT,                    -- full response body
     http_status INTEGER, ok INTEGER, is_error INTEGER,
     error TEXT, exit_code INTEGER, stderr TEXT
   );
   CREATE INDEX events_ts ON events(ts_request_ms);
   CREATE INDEX events_connector_ts ON events(connector, ts_request_ms);

   -- routine/script lifecycle (replaces sync-progress.log and friends)
   CREATE TABLE runs (
     id INTEGER PRIMARY KEY,
     ts_start TEXT NOT NULL, ts_end TEXT,
     source TEXT NOT NULL,             -- routine or system name
     status TEXT, exit_code INTEGER,
     message TEXT, context TEXT       -- JSON
   );
   ```

   The db opens with WAL and a busy timeout so concurrent routines can write
   safely; wrappers and routines share one small stdlib writer module so the
   schema has a single owner. The path resolves from `HOMINEM_AGENT_DB`, default
   `~/.hominem/agent.db` — one db per machine, matching the two-machine
   topology rather than merging logs across it. The audit surface stays
   queryable (`SELECT` replaces `grep`).
2. **Hominem is the system of record.** Finance moved there 2026-10-13
   ("the sheet is retired"); the resume is *generated from Hominem*
   (resume_publishing). Data rules from Charles are embedded with dates:
   *"Plaid is INGEST ONLY and is never a source for analysis" (2026-11-06)*.
3. **Idempotency and state anchors everywhere.** `cadence_regen` creates only
   tasks that aren't open; the txn sync dedupes by natural-key upsert and
   re-runs windows from a state file (`hominem_sync_state.json`);
   `media-drive-sync` is one-way add/update, never deletes.
4. **Two-machine topology.** The VM (hatch) holds connectors and routines;
   the Mac is audited via Drive mirrors (memory-mirror) and browser transport
   (`bmcp.py`: VM → Mac Chrome via tailnet :8977). Hardcoded
   `/home/hatch/workspace/...` paths appear throughout and are the first
   thing conversion must fix.

## 2. Classification — all 20 categories

### A. Live engine subsystems (convert first, highest value)

| Category | Contents | Verdict |
| --- | --- | --- |
| `systems-live/wealth-manager` (14 files) | Starling+Plaid→Hominem txn sync (idempotent upserts, state-anchored windows), morning brief (exception-led, Plaid ingest-only), Layer 1 census/integrity, monthly close, forward look, category dashboard, migration driver | **The crown jewels.** A layered finance engine with tickets (WYA-228) and dated data rules. Convert as a `systems/wealth-manager` subsystem, tests on the sync's idempotency contract. |
| `memory-mirror` (6 files) | Mac↔Muse memory sync; README declares conflict rules: Charlie's edits authoritative, conflicts flagged never overwritten | **Engine memory layer.** The sync rules are the product; code is secondary. Convert as `systems/memory-mirror` with the README as its doctrine doc. |
| `systems-live/calendar-analysis` (3 files) | Calendar event analysis + moves | Convert as `systems/calendar-analysis`. |
| `routines/cadence_regen.py` | Idempotent weekly/monthly Google Tasks regeneration; templates inline | Engine routine runner. De-hardcode the hatch path, externalize template file. |

### B. Engine infrastructure

| Category | Contents | Verdict |
| --- | --- | --- |
| `custom-connectors` (9 connectors) | 4 logging wrappers (gws/notion/linear/ponti-log), playwright-chrome, youtube-music, replicate, 3 `legacy-*` (retired: ponti-api, starling, openrouter) | **The connector contract.** Wrappers convert as first-class `connectors/`; the 3 legacy ones stay archived as reference only. |
| `browser-mcp` (2 files) | VM→Mac Chrome bridge over tailnet | Convert as `transport/` — the two-machine topology's other half. |
| `tools/` (2 files) | `search_name.py` (name-mention scanner), `media-drive-sync.py` (one-way Drive sync, never deletes) | Both follow engine conventions (read-only or add-only). Convert to `routines/`. |

### C. Skills and doctrine (→ kernel graduation queue, not engine code)

| Category | Contents | Verdict |
| --- | --- | --- |
| `custom-skills` (7 skills) | `local-verify-before-asserting-existence` — **already graduated** (kernel law 26). `recovered-skill-notes` — **already retired** (audit verdict 2026-10-15, confirmed by our read). `guard_irreversible_bulk_operations`, `pin_source_version_before_use`, `verify_each_thread_before_replying` — behavioral laws for a personal assistant; candidates for a personal-principles merge (same treatment as law 26). `resume_publishing` — doctrine: resume is generated from Hominem, one source. `spoken_audio_saved_voice` — a dated amendment to braniac `spoken-audio` (diff confirmed: 95 lines differ, it constrains *when* to send, not *how* to make audio). | Feed into the kernel braniac graduation queue; `spoken_audio_saved_voice` merges during spoken-audio's graduation. |
| `bateman-regime` (7 files) | index, taste, wardrobe, the-flat, social-polish, grooming + `resolve.py` | Personal doctrine/knowledge — **private content, not kernel**. Convert as engine `knowledge/`. |

### D. Personal data pipelines (convert selectively)

| Category | Contents | Verdict |
| --- | --- | --- |
| `food-orders` (3 files) | Tesco+Amazon receipts (Gmail)→CSV; documents the Amazon price quirk (symbol+integer pence) | Convert — the quirk is hard-won knowledge. |
| `trakt-sync` (2 files) | Trakt→media sheet sync with a real DESIGN.md (sheet id, source semantics) | Convert; DESIGN.md becomes its doctrine doc. |
| `drive-empty-folders` (2 files) | Read-only Drive subtree survey + trash roots | Convert (read-only-first design is engine-grade). |
| `projects/` (12 files) | doctrine/immigration Notion page creators; chrome-automation research (openclaw dispatch, wait-gate) | Chrome-automation-research converts to `transport/` research notes; the two Notion one-offs stay archived (doctrine pages already exist). |
| `sub-scan`, `playlist-banner-template` | Subscription scanner; banner applier | Convert `sub-scan` (pairs with subscription-status skill); playlist-banner is one-off — archive. |
| `drill-v2` (7 files) | resolve.py, fetch_all.py, cover/banner compositing v1-v5 | Generation scratch with a version ladder — the *latest* variant may be one useful compositing utility; otherwise archive. |

### E. Retained material (~60% of the bytes) — ruling reversed 2026-11-22

**Charles's ruling: nothing is pruned; all of it is used.** The original
verdict below is kept for the record and superseded by the dispositions in
[04-plans.md](04-plans.md): workflow definitions mined, the latest
physique-logger build revived as a system, goal content kept as knowledge,
the dedupe utility ported, the vendored lib kept as a pinned dependency.

| Category | Contents | Verdict |
| --- | --- | --- |
| `.jarvis/idea-executions`, `.jarvis/workflow-runs` (~40 files) | `build_front_*.py`, `gen12..gen48`, `make14..make27`, `cluster*`, `fix/patch/residue` | One-off generation scratch from dead idea-executions. This is exactly what the idea-execution lifecycle was supposed to compost. **Delete from archive.** |
| `space-versions` (4.9 MB, 75% of the archive) | daily-physique-logger v1–v9 **build artifacts** (`.space-build/assets/*.js`) | Compiled output, nine dead versions. **Delete from archive.** |
| `file-versions` + `goals/god-like-physique` (duplicates of each other) | legendary-cut outline + chart | Duplicated one-off; keep one copy under knowledge if at all. |
| `audits` (1 file) | dedupe sweep script | Served its one audit. Delete. |
| `.pylibs/zxingcpp` | vendored barcode lib | Delete; reinstall from source if ever needed. |
| `.DS_Store` ×6, `.write-lock` ×6 | junk | Delete. |

## 3. Target layout — `~/Developer/hominem/`

The engine repo, named Hominem:

```
hominem/
  AGENTS.md            engine conventions: logging wrappers writing to
                       ~/.hominem/agent.db (no log files), idempotency,
                       two-machine topology, Hominem as record
  log/                 the shared sqlite writer module (single schema owner)
  connectors/          gws-log, notion-log, linear-log, ponti-log,
                       playwright-chrome, youtube-music, replicate
  transport/           bmcp.py, shot.py, chrome-automation notes
  systems/             wealth-manager/ (with morning brief data rules),
                       calendar-analysis/, memory-mirror/
  routines/            cadence_regen, food-orders, trakt-sync,
                       media-drive-sync, drive-empty-folders, sub-scan, tools/
  knowledge/           bateman-regime/, doctrine docs (private, never kernel)
  skills-notes.md      the 5 ungraduated custom-skills + pointer to the
                       kernel braniac graduation queue
  archive/             the original 2026-11-21 archive minus category E,
                       as read-only history
```

Kernel keeps what is universal (skills, laws, procedures); the engine keeps
what is personal (systems, connectors, doctrine, data pipelines). The resume
and finance flows target Hominem and stay engine-side; nothing in category A
or B belongs in the published kernel catalog.

## 4. Conversion protocol (per script)

1. De-hardcode: `/home/hatch/workspace/...` and `~/workspace/...` become
   config/env; no script keeps a machine path.
2. **Logs become rows, not files:** each wrapper's JSONL append is replaced
   by a call to the shared sqlite writer (`events` insert); each routine's
   progress log (`sync-progress.log` and friends) becomes `runs` rows. No
   converted script writes a log file.
3. Secrets: none of the sampled scripts inline keys (they shell out to
   wrappers), but verify per-script during conversion; anything with an
   embedded token goes to env config.
4. Preserve the dated data rules verbatim — they are Charles's decisions,
   not code comments to tidy.
5. Each converted system gets the same treatment the kernel loop gives a
   skill: **run it live** (or against a mock) before declaring it converted;
   idempotency contracts (txn sync, cadence) get explicit re-run tests.
6. The logging-wrapper convention gets documented once in AGENTS.md and
   enforced by review, not per-script comments.

## 5. Sequencing and effort

1. **Engine skeleton + AGENTS.md conventions** (hours) — the founding commit.
2. **Connectors + transport** (half day) — everything else depends on them;
   porting the four wrappers to the `log/` sqlite writer is part of this
   step, with the schema bootstrapped in the same commit.
3. **wealth-manager** (a day) — most valuable, most contract-laden; convert
   with idempotency tests first.
4. **memory-mirror + calendar-analysis** (half day).
5. **routines + pipelines** (a day, parallelizable — a good Rex-pane fan-out
   candidate, worker per category).
6. **custom-skills → kernel graduation queue** (rides the existing one-by-one
   loop; three behavioral laws + resume doctrine + the spoken-audio amendment).
7. **Archive prune** (minutes): delete category E (~5 MB of the 6.5 MB).

Risks: the wealth-manager talks to live bank APIs (Starling/Plaid) — convert
with mocked sources and one supervised live run; trakt/media pipelines
reference a specific Drive sheet and folder ids — keep them in config, never
in code; the two-machine paths mean some scripts only fully run on the VM —
converting them here makes the Mac the dev surface, which changes where
secrets and wrappers must resolve.
