# Hominem

Hominem is Charles's personal engine: the connectors, routines, systems and
doctrine that were salvaged from the JARVIS/Muse workspace (archive of
2026-11-21) and rebuilt here. The conversion analysis and category verdicts
live in [docs/CONVERSION-ANALYSIS.md](docs/CONVERSION-ANALYSIS.md); this file is the
operating law.

## The four laws

1. **Every external action goes through a logging wrapper, and every log
   goes to the audit database.** Wrappers record one `events` row per
   external call; routines record their lifecycle as `runs` rows. No Hominem
   component ever writes a log file. The database is `~/.hominem/agent.db`
   (override with `HOMINEM_AGENT_DB`), opened WAL with a busy timeout, one db per
   machine. `packages/cli/src/agent/log/agent_log.ts` is the single schema
   owner — do not open the db elsewhere.
2. **Hominem is the system of record.** Finance has lived there since
   2026-10-13 (the sheet is retired); the resume is generated from it.
   Dated data rules from Charles are law, not comments to tidy: *"Plaid is
   INGEST ONLY and is never a source for analysis"* (2026-11-06). Preserve
   them verbatim when porting.
3. **Idempotency and state anchors.** Routines are safe to re-run: natural-key
   upserts, state-anchored windows, add/update-only syncs. A routine that
   destroys data does it behind an explicit, named irreversible operation —
   never as a side effect.
4. **Two machines, no machine paths.** Hominem runs on the hatch VM and the
   Mac. Nothing hardcodes `/home/hatch/...`, `/opt/...`, or `~`-anchored
   workspace paths: resolve real binaries, credentials and the db from
   environment config, and fail with a message naming the missing variable.

## Working rules

- **A conversion is not done until it has run.** Port against a mock backend
  first, then one live run when the backend is real. Report what was run and
  what was not. A claim that something works requires the read-back.
- **Secrets live in the environment**, never in code, logs, or the repo.
  Wrappers that reach authenticated services take their credential paths
  from env and never echo secret values into `events` rows.
- **Tests:** `pnpm --filter @hominem/cli test` and
  `pnpm --filter @hominem/cli typecheck`; every connector port lands with
  its mock-backend test in the same change.
- **Commits** follow Conventional Commits; the audit database and `__pycache__`
  are never committed (see `.gitignore`).
- The whole archive is used — Charles's ruling (2026-11-22): nothing is
  pruned. Every category, including the generation scratch and build
  artifacts, gets a use or a permanent home; see
  [docs/04-plans.md](docs/04-plans.md) for the dispositions. The archive
  lives machine-local under `archive/2026-11-21/` (gitignored, never
  committed).
