# Travel MCP — completion prompt: build the remaining 35 tools

You are building on the Hominem MCP server (`https://api.ponti.io/api/mcp`).
The travel domain's read tier and import are built, deployed, and
populated. This prompt commissions the rest of the system: the write
tier, the maintenance tools, the export, and the audit read — the
tools that make Hominem the place travel is *managed*, not just
stored. All contracts live in the master spec; this prompt restates
none of them.

## 0. The contract authority — verify before you build

The single contract authority is `mcp-tools-prompt.md` (the travel
MCP tools spec), now §§0–23. Verify your local copy before writing
any code:

- File: `mcp-tools-prompt.md`, **1,234 lines**
- SHA-256: `f3ce43ba5ec65a376113ce38c09409576802ff58db786579afaa0c24ec1dd84f`

If your copy differs, it is stale — stop and obtain the current file
from the operator. Do not build from memory, from an earlier package,
or from this summary. (§21 of the spec exists because a stale copy
already cost one round-trip.)

## 1. State of the world (operator-verified, 2026-10-16)

- **157 tools live** on the production endpoint, **24 of them
  `travel_*`**: every Tier-1 read and aggregate (§§6–7, except §7.7
  and §7.8 below), `travel_import` (§11), and `travel_residence_list`
  / `travel_residence_get` (§20.3). Do not rebuild or alter these
  except where §5 below requires it.
- **Production is populated.** The live import ran on 2026-10-16 and
  converged: 79 Places, 2 Residences, 53 Journeys, 62 Segments,
  41 Transport, 53 Stays, 30 Airports, 16 Ideas — 336 records; a
  full re-import returned created 0 / updated 0 / unchanged 336.
  These counts are the baseline your work must not disturb (§4).
- **The source sheets are archived and read-only.** The `travel`
  Google Sheet is locked; there is no Sheets access in this build
  and none is needed. Nothing in this build reads or writes a sheet.
- **Legacy tables stay frozen** (spec §16): `app.travel_trips`,
  `app.travel_segments`, `app.travel_trip_attendees` — untouched,
  unread, unmigrated.
- **Authorization** (spec §17): the `travel:write` scope gates every
  mutating tool, dryRun included. Reads stay `travel:read`.

## 2. What to build — the 35 tools

Contracts are the cited spec sections. Build in this order:

**A. Audit + export foundations**
1. `travel_entity_history` — §7.7 (contract) + §5.11 (audit rules).
   Build this first: every write below must land in the audit log it
   reads. If the audit store does not yet exist, create it now and
   backfill nothing — it records from this build forward; say so in
   your report.
2. `travel_export` — §7.8, as amended by §20.4 (sheet format
   regenerates all 81 Places rows, Residences included).

**B. Tier-2 single-entity writes — §9**
3. `travel_journey_create`, `travel_journey_update`,
   `travel_journey_delete`
4. `travel_segment_create`, `travel_segment_update`,
   `travel_segment_delete`
5. `travel_transport_create`, `travel_transport_update`,
   `travel_transport_delete`
6. `travel_stay_create`, `travel_stay_update`, `travel_stay_delete`
7. `travel_place_create`, `travel_place_update`
8. `travel_airport_create`, `travel_airport_update`
9. `travel_idea_create`, `travel_idea_update`

**C. Pass-2 write tools — §9.1**
10. `travel_journey_save` (the centrepiece — atomic whole-dossier
    upsert), `travel_journey_clone`
11. `travel_segment_reorder`, `travel_segment_merge`
12. `travel_place_delete`, `travel_airport_delete`,
    `travel_idea_delete`
13. `travel_place_refresh` — dryRun-first reconciliation (§9.1);
    see the safety rule in §4.3 below
14. `travel_transport_get`, `travel_stay_get` — the two missing
    single-entity reads (§9.1; transport obeys §3.5 ambiguity)

**D. Tier-3 maintenance — §10**
15. `travel_place_merge`, `travel_airport_merge`

**E. Residences — §20.3**
16. `travel_residence_create`, `travel_residence_update`,
    `travel_residence_delete` (list/get already live)

**F. Tag registration — §5.13**
17. Extend the generic tag tools' `entityType` enum for travel
    entities (journey, segment, transport leg, stay, airport,
    travel place, idea, residence) — distinctly from the existing
    venue `places` type. Acceptance: spec §12 item 17.

## 3. Cross-cutting rules (binding, from §5 and §17)

- §5.1 named errors only; §5.2 case-insensitive return-existing
  creates; §5.3 `dryRun` on every mutating tool; §5.4 counters
  distinguishing created/updated/unchanged; §5.5 no silent
  truncation; §5.6 structuredContent parity; §5.8 no auto-creating
  referenced entities; §5.9 guarded deletes (`iUnderstand`,
  snapshot returned, `notFound` non-fatal); §5.11 audit on every
  write; §5.12 `ifUpdatedAt` optimistic concurrency
  (`version_conflict`); §5.14 `archived` settable via journey/place
  update.
- Every mutating tool in §2 requires the `travel:write` scope,
  including its dryRun invocations (§17.2). Refusals return
  `insufficient_scope`.
- One parity defect in the already-deployed tier, fix in this
  build: `travel_residence_list` returns no
  `total`/`limit`/`offset`/`truncated` — bring it to §5.5 parity.

## 4. Production-safety rules (new — the store is live now)

1. **Probe rows only.** Exercise creates/updates/deletes/merges/
   reorder/clone/save against rows you create for the purpose
   (names prefixed `ZZZ Probe`), then delete them and prove the
   deletion in your report. Never mutate, merge, reorder, refresh-
   apply, or delete a real imported record to test your code.
2. **Baseline invariance.** After your work, with probes cleaned
   up, the store must still read exactly: Places 79, Residences 2,
   Journeys 53, Segments 62, Transport 41, Stays 53, Airports 30,
   Ideas 16 — and a full `travel_import` re-run must still converge
   to created 0 / updated 0 / unchanged 336. Report both.
3. **`travel_place_refresh`: dry-run only.** Its dry-run diff on
   current data must include the Reykjavik row (§12 item 16) —
   report the full diff. Never ship a run with `dryRun: false`;
   applying a refresh is the operator's decision, not a build step.
4. **Validate findings are source data, not bugs.** `travel_validate`
   currently reports: duplicate legacyIds T-004/T-005 (by design,
   §4.1); 7 places Visited without a segment (Bilbao, Brooklyn,
   Burbank, Palma de Mallorca, Reykjavik, Salt Lake City,
   Vancouver); journey_overlap JRN-014 ↔ JRN-015; segment_overlaps
   SEG-104/SEG-108 and SEG-013/SEG-105; 3 thin-evidence stays.
   Do not "fix", merge, or clean any of these. They are the
   operator's data decisions, pending separately.
5. **§15 stays reserved.** No attendees model, no money/documents
   in travel. Do not build them, do not stub them.
6. **Do not re-run the import as part of this build** except the
   read-only convergence check in rule 2 (a dry-run is acceptable
   evidence; a live re-run is idempotent but unnecessary).

## 5. Evidence to return (report format: spec §14, plus)

1. Confirmation that your spec copy matched the §0 checksum.
2. All 59 `travel_*` tool names live on the production endpoint
   (the tools list should go from 157 to 192 total: +35 travel
   tools; the §5.13 enum change adds no tools).
3. The write-authorization addendum §17.1 requires, if not already
   delivered: how finance/possession writes are authorized today,
   and an explicit statement if they have no write scope.
4. **§16 proof:** `trip_history` output byte-identical before/after
   this build. If no pre-build snapshot exists from the first
   build, take one before any schema change in this build and say
   plainly that the comparison baseline starts now.
5. **§17 proof (live, with the operator's existing credential):**
   a read-scope token refused with `insufficient_scope` on one
   create, one update, one delete, and one import dryRun — with the
   target rows provably unchanged — and the write-scope path
   succeeding, with the writes visible via `travel_entity_history`.
6. Baseline-invariance evidence (§4.2): final entity counts + the
   import convergence counters + the `travel_place_refresh`
   dry-run diff.
7. Anything you could not build as specced, and why — named, not
   silently substituted.

Deployment of these tools does not complete the project: the
operator then runs the full §12 acceptance (items 1–22) against
production. Build so that every §12 write item can be executed by
the operator using only probe rows and the tools themselves.

--- PROMPT END ---
