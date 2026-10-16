# Travel MCP Tools — Prompt for the Coding Agent

_Written by Wyatt, 2026-10-15. Everything between the two `--- PROMPT ---` markers
is the prompt, verbatim. Ground truth in §3/§12 was read live from the sheet
on 2026-10-15 — do not substitute your own counts._
_Pass 2 (same day): audited against every operation the sheet supports and
against Hominem's existing generic tooling; 16 tools added (54 total) —
notably the atomic whole-journey save, export, audit history, timeline /
insights, and the missing deletes. Amendments are integrated into the
sections they belong to, not appended as an afterthought._

--- PROMPT START ---

# Build the Travel domain (`travel_*`) for the Hominem MCP server

## 0. Who / where / what already exists

You are the coding agent for **Hominem**, Charles Ponti's personal API and
MCP server at `https://api.ponti.io/api/mcp` (bearer-token auth). The server
already exposes domain-prefixed tool families — `finance_*` (21 tools),
`possession_*`, `container_*`, `career_*`, `task_*`, `note_*`, `person_*`,
etc. (~132 tools in the last full dump). Possessions and finance were both
migrated from Google Sheets into Hominem in Oct 2026 and their sheets were
retired; **travel is the last sheet-backed domain, and this job is its
migration + tool layer.**

Verified current state — do not re-litigate, and verify before claiming
otherwise (dump the live `tools/list` and read each tool's `inputSchema`
before asserting any tool or parameter does/doesn't exist; a wrong
parameter name is silently stripped by Zod and looks exactly like a
server bug):

- The ONLY existing travel-adjacent tool is `trip_history` — read-only,
  flat, `from`/`to`/`limit` (default 20, max 50), returns trip ids, dates,
  destinations, attendee names. It has no journey/segment structure and
  cannot answer place, airport, booking, stay, or stats questions.
  (`place_visit_history` is restaurant/venue visits — a different domain,
  not travel.)
- There is no `travel_*` family, no write path, and no structured store
  for journeys/segments/legs/stays. If your inspection shows this has
  changed, report what you found before building.

**Mission:** (1) model the travel data in Hominem per §2–§3, (2) build the
`travel_*` MCP tools in §6–§10, (3) build the one-shot sheet→Hominem import
in §11, (4) pass every acceptance test in §12 against live data. The Google
Sheet is the **migration source only** — no MCP tool may read Google
Sheets at runtime.

## 1. The source data

Google Sheet **`travel`**, id `17KYUr6U9iI5WhQIJfH_CctMo1K1zAZIMB6lc2hxFenY`,
7 tabs: Places, Journeys, Segments, Transport, Stays, Airports, Ideas.
A read-only reference CLI exists at `~/workspace/travel/travel.py` (in the
operator's workspace — ask for its output if you can't access it; its
command set is the behavioural spec for the Tier-1 read tools: `places`,
`countries`, `journeys`, `journey <id>`, `segments`, `segment <id>`,
`flights`, `airports`, `stays`, `booking <ref>`, `wishlist`, `ideas`,
`unresolved`). Model documentation: §2 below is authoritative and complete;
you do not need the sheet's README.

## 2. Data model (v2 — implement exactly this)

Dates are `YYYY-MM-DD` strings throughout. There are no times and no
timezones in this domain. Blank dates in legacy data mean "unknown" —
preserve them as null, never invent a date.

### 2.1 Journey — the home-to-home arc (the planning unit)

| field       | type           | notes                                        |
| ----------- | -------------- | -------------------------------------------- |
| `id`        | uuid           | server-generated primary key                 |
| `legacyId`  | string, unique | sheet id, e.g. `JRN-042`                     |
| `name`      | string         | e.g. `Australia — Mar 2024`                  |
| `startDate` | date \| null   |                                              |
| `endDate`   | date \| null   | must be ≥ startDate when both present        |
| `purpose`   | enum \| null   | `leisure` \| `business` \| `mixed` \| `move` |
| `notes`     | string \| null |                                              |

A journey's segment list is **derived** from Segments (ordered by `seq`);
the sheet's comma-joined `segments` string column is a migration artefact,
do not model it as a stored field.

### 2.2 Segment — one stop, time spent in one place within a journey

| field           | type               | notes                                                                         |
| --------------- | ------------------ | ----------------------------------------------------------------------------- |
| `id`            | uuid               |                                                                               |
| `legacyId`      | string, unique     | e.g. `SEG-020`; preserves the pre-v2 trip numbering                           |
| `journeyId`     | uuid, FK → Journey | required; a segment cannot exist outside a journey                            |
| `seq`           | integer ≥ 1        | order within the journey; unique per journey                                  |
| `placeId`       | uuid, FK → Place   | resolve from the sheet's `place` name at import                               |
| `place`         | string             | denormalised place name on every read (clients must not need a second lookup) |
| `arrivalDate`   | date \| null       |                                                                               |
| `departureDate` | date \| null       | ≥ arrivalDate when both present                                               |
| `notes`         | string \| null     |                                                                               |

The sheet also has a `destinations` column on Segments — it is a noisy
legacy grouping artefact (comma-joined place names, e.g. `Los Angeles,
Sydney` on a Sydney segment). **Do not model it.** Drop it at import and
report that you dropped it.

Most journeys have exactly one segment (the degenerate case). One journey
may legitimately contain the same place twice (see JRN-042 in §12).

### 2.3 Transport — one leg (flight or train)

| field          | type                              | notes                                           |
| -------------- | --------------------------------- | ----------------------------------------------- |
| `id`           | uuid                              |                                                 |
| `legacyId`     | string, **NOT unique — see §4.1** | sheet id, e.g. `T-003`                          |
| `date`         | date \| null                      |                                                 |
| `mode`         | enum                              | `air` \| `rail`                                 |
| `origin`       | string                            | airport/station code, FK → Airport.code         |
| `destination`  | string                            | airport/station code, FK → Airport.code         |
| `carrier`      | string \| null                    |                                                 |
| `number`       | string \| null                    | e.g. `BA121`, `VA842`                           |
| `bookingRef`   | string \| null                    |                                                 |
| `depSegmentId` | uuid \| null, FK → Segment        | segment this leg departs from                   |
| `arrSegmentId` | uuid \| null, FK → Segment        | segment this leg arrives into                   |
| `journeyId`    | uuid, FK → Journey                | required                                        |
| `legacyTrip`   | string \| null                    | pre-v2 `TRP-xxx` reference, keep for provenance |
| `notes`        | string \| null                    |                                                 |

Link semantics (§3.2) are load-bearing — read them before writing any
leg-related code.

### 2.4 Place — every place visited or wanted

| field          | type           | notes                                                                                                                                                                                                    |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | uuid           |                                                                                                                                                                                                          |
| `legacyId`     | string, unique | e.g. `PLC-001`                                                                                                                                                                                           |
| `place`        | string         | unique with `country`, case-insensitive                                                                                                                                                                  |
| `country`      | string         |                                                                                                                                                                                                          |
| `type`         | string         | e.g. `city`, `country` — free string in legacy data, keep it a string, do not enum it                                                                                                                    |
| `status`       | enum           | `Visited` \| `Want to go` \| `Lived in` (exact casing on reads — this is display vocabulary). Stored source status, kept for parity; the queryable truth is the derived `relationships` object — see §20 |
| `firstVisited` | date \| null   | stored at import; refreshed only by a later import or an explicit place update — visit history on reads is derived from segments, see §3.3 and §9                                                        |
| `lastVisited`  | date \| null   | same                                                                                                                                                                                                     |
| `notes`        | string \| null |                                                                                                                                                                                                          |

Note the deliberate quirk: Places contains both city rows (`Byron Bay`,
type `city`) and at least one country row (`Iceland`, type `country`,
status `Want to go`) alongside a city row for its capital (`Reykjavik`,
type `city`). Do not "clean this up" — model it as-is; §4.2 covers the
related discrepancy.

**Uniqueness is absolute (§20):** (place, country) is unique in this
table, no exceptions. The source's two apparent duplicates (London
PLC-018/PLC-048, Los Angeles PLC-019/PLC-047) are not two places — the
`Lived in` rows are **Residence records** (§2.8) attached to the
canonical Place, routed there at import (§11). Every Place read also
returns a derived `relationships` object —
`{ visited: boolean (has segments), segmentCount, livedIn: boolean
(has ≥1 residence), currentlyHome: boolean (a residence period is
open), wantToGo: boolean }` — because a place's facts are
multidimensional and no single status value can carry them.

### 2.5 Stay — where he slept

| field        | type                       | notes                                                                                                                                               |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | uuid                       |                                                                                                                                                     |
| `legacyId`   | string, unique             | e.g. `STY-001`                                                                                                                                      |
| `segmentId`  | uuid \| null, FK → Segment | required UNLESS `evidence = want` — see §19 (wishlist stays are unlinked by design)                                                                 |
| `journeyId`  | uuid \| null, FK → Journey | same rule as `segmentId`; the two are both null or both set, never exactly one; when set, keep consistent with the segment's journey                |
| `checkIn`    | date \| null               |                                                                                                                                                     |
| `checkOut`   | date \| null               | ≥ checkIn when both present                                                                                                                         |
| `city`       | string                     |                                                                                                                                                     |
| `country`    | string \| null             |                                                                                                                                                     |
| `property`   | string \| null             |                                                                                                                                                     |
| `bookingRef` | string \| null             |                                                                                                                                                     |
| `evidence`   | enum                       | `email` \| `calendar` \| `thin` \| `want` — `thin` = recorded but weakly evidenced, needs a human decision; `want` = wishlist stay, not a past stay |
| `notes`      | string \| null             |                                                                                                                                                     |

### 2.6 Airport — reference table (includes rail stations)

| field         | type                      | notes                                                                                                      |
| ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`          | uuid                      |                                                                                                            |
| `legacyId`    | string, unique            | e.g. `ARP-006`                                                                                             |
| `code`        | string, unique, uppercase | IATA code, or station code (e.g. `NYP` = New York Penn Station, a rail entry — this table serves rail too) |
| `name`        | string                    |                                                                                                            |
| `servesPlace` | string                    | **the place you actually go to via this code — see §3.1**                                                  |
| `city`        | string                    |                                                                                                            |
| `country`     | string                    |                                                                                                            |
| `notes`       | string \| null            |                                                                                                            |
| `latitude`    | number \| null            | all 30 current rows have coordinates                                                                       |
| `longitude`   | number \| null            |                                                                                                            |

### 2.7 Idea — travel todos / wishlist items that aren't places

| field      | type           | notes                                |
| ---------- | -------------- | ------------------------------------ |
| `id`       | uuid           |                                      |
| `legacyId` | string, unique | e.g. `IDA-001`                       |
| `idea`     | string         |                                      |
| `type`     | enum           | `experience` \| `admin` \| `housing` |
| `status`   | enum           | `open` \| `done`                     |
| `notes`    | string \| null |                                      |

### 2.8 Residence — a period of living in a place (§20)

One record per source `Lived in` row; the home-base dimension of a
Place, with full CRUD (§20.3). A place may have several residence
records over a life; each record holds one or more periods.

| field                | type                    | notes                                                                                              |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                 | uuid                    |                                                                                                    |
| `legacyId`           | string, unique          | the source Place row's id, e.g. `PLC-048` — provenance lives here now                              |
| `placeId`            | uuid, FK → Place        | the canonical place; required                                                                      |
| `periods`            | array of period objects | ≥1 per record; see below                                                                           |
| `sourceFirstVisited` | date \| null            | the source row's `first_visited`, stored verbatim for exact export round-trip; never used by logic |
| `sourceLastVisited`  | date \| null            | same                                                                                               |
| `notes`              | string \| null          | verbatim from the source row                                                                       |

Period object: `{ startDate (required), endDate (date \| null),
ongoing (boolean), precision (day \| month \| year, default day),
note (string \| null) }`. `endDate: null` + `ongoing: false` means
"ended, exact end not recorded" (the note usually says) — **never**
invent an end date to fill it. `ongoing: true` requires
`endDate: null`. At most one ongoing period may exist across ALL
residences at any time (there is one current home) — enforce at write
(`multiple_current_homes`).

Migrated records (periods derived from the source rows' fields +
notes, nothing invented):

- PLC-047 → Los Angeles: periods `[{ startDate: 2016-01-01,
  endDate: null, ongoing: false, precision: day, note: "lived here
  until Sep 2026 move" }]`, sourceFirst/Last = 2016-01-01 / 2016-01-01.
- PLC-048 → London: periods `[{ startDate: 2017-01-01, endDate: null,
  ongoing: false, precision: month, note: "also lived here Jan
  2017" }, { startDate: 2026-09-23, endDate: null, ongoing: true,
  precision: day, note: "lives here since Sep 23, 2026" }]`,
  sourceFirst/Last = 2017-01-01 / 2017-01-01.

## 3. Core semantics (load-bearing — violations are spec failures)

### 3.1 The airport is not the stop

`Airports.servesPlace` is the semantic destination of a code. Canonical
example: `BNK` is Ballina Byron Gateway Airport, city Ballina — but the
stop is **Byron Bay** (`servesPlace = Byron Bay`). Any tool that resolves
a leg, a place filter, or a "have I been to X" question must resolve
through `servesPlace`, never through the airport's city or name. Filters
accept a place name, a city name, or a code interchangeably and match
against all three (this is how the reference CLI's `flights --from/--to`
behaves).

### 3.2 Leg → segment links decide what counts as a visit

- A leg with **both** `depSegmentId` and `arrSegmentId` is an internal leg
  between two stops of its journey.
- A leg with **exactly one** link is a boundary leg: home ↔ first/last
  stop (home is not modelled as a segment). Example: JRN-042's first leg
  `LAX→SYD` has only `arrSegmentId` (SEG-020 Sydney); its last leg
  `SYD→LAX` has only `depSegmentId` (SEG-022 Sydney). These are normal,
  complete legs — never flag them as unresolved.
- A leg with **neither** link is a layover or positioning leg and does
  **not** constitute a visit to its origin/destination places. Current
  data has exactly one: T-026 `LGW→KEF` (2018-02-28, JRN-009).
- Nothing in this domain may count a visit, a country, or a place's
  visited status from Transport rows. Visits come from Segments only.

### 3.3 "Visited" is derived from Segments, not trusted from Places

- A place counts as visited iff at least one Segment references it.
  Country counts likewise count **segment places only**.
- Ground truth (live, 2026-10-15): segment-derived = **10 countries**
  (Australia, Canada, Denmark, Germany, Italy, Portugal, Puerto Rico,
  Spain, UK, USA). Places-status-derived = 11. The difference is Iceland
  — see §4.2. Both numbers are "correct" answers to different questions;
  stats tools must return the segment-derived number and name the method.
- `Places.status` / `firstVisited` / `lastVisited` are imported as stored
  and returned by place reads (parity with source), but every aggregate
  (countries, stats, "have I been to X") must be computed from Segments
  and, where it disagrees with the stored Place row, the aggregate wins
  and the disagreement is surfaced by `travel_validate` (§7.3) — never
  silently reconciled, never silently "fixed" in the data.

### 3.4 Read/write parity

Every field accepted on any write must be returned on every read of that
entity (this exact gap — a write-only `orderNumber` — burned a full day
in the finance port). No write-only fields. No exceptions.

### 3.5 Legacy IDs are provenance, not keys

Clients address entities by server `id` (uuid). `legacyId` is returned on
every read, is searchable, and is the import's idempotency key (§11) — with
the single exception of Transport (§4.1). A lookup by a non-unique legacy
id must return all matches or a named `ambiguous_legacy_id` error, never
an arbitrary first match.

## 4. Known data-quality traps (verified live 2026-10-15 — handle, don't hide)

### 4.1 Duplicate Transport legacy IDs

`T-004` and `T-005` each exist **twice**:

- T-004: 2024-03-17 `SYD→MEL`, Virgin Australia VA842, booking `KWGLMJ`,
  JRN-042 — and 2026-11-25 `LHR→CVG`, British Airways BA121, booking
  `YQUQ9J`, JRN-048.
- T-005: 2024-03-22 `MEL→BNK`, Jetstar JQ464, booking `NLEVSZ`, JRN-042 —
  and 2026-11-29 `CVG→LHR`, British Airways BA120, booking `YQUQ9J`,
  JRN-048.
  All other tabs' legacy IDs are unique. Consequences you must implement:
  Transport's import idempotency key is the composite
  `(legacyId, journeyLegacyId, date, origin, destination)`; §3.5's
  ambiguity rule applies to T-004/T-005 lookups; `travel_validate` must
  report exactly these two collisions and no others on current data.

### 4.2 Reykjavik / Iceland — visited with no segment

Places says `Reykjavik` (PLC-030) is `Visited`, first/last visited
2018-02-28 — the date of the T-026 LGW→KEF layover leg. There is **no**
Reykjavik segment. Airports carries the truth in prose: KEF's notes say
`layover only — not a visit`. Per §3.3, segment-derived stats exclude
Iceland; `travel_validate` must list Reykjavik as
`place_visited_without_segment`. **Do not edit the Place row, do not
create a segment, do not delete the leg.** The operator decides data
corrections; your job is to surface them. (Other Places rows may also
lack segments — report all of them the same way; Reykjavik is the one
that must appear.)

### 4.3 Sparse legacy fields are normal

45 of 53 journeys have blank `purpose`. Several journeys have blank
`startDate`. 6 stays have `evidence = want` (they are wishes, not stays —
exclude them from any "where did he sleep" aggregate but include them in
stay lists when no evidence filter is given). Blank ≠ corrupt: import
faithfully, validate gently (report, don't reject).

### 4.4 JRN-042 is the stress case

One journey, 4 segments (Sydney twice: SEG-020 seq 1, SEG-021 Melbourne
seq 2, SEG-006 Byron Bay seq 3, SEG-022 Sydney seq 4), 5 legs, two
boundary legs, one airport (BNK) whose city ≠ stop. If your dossier,
stats, and leg-resolution code all handle JRN-042 correctly, they
probably handle everything. §12 tests it explicitly.

## 5. Cross-cutting conventions (every tool, no exceptions)

These are the Hominem house rules, earned in the finance/possessions
ports. They apply to all tools in §6–§11.

1. **Named errors, never opaque 500s.** Every rejection returns a stable
   machine-readable `reason` string (e.g. `unknown_journey`,
   `unknown_airport`, `unknown_place`, `unknown_segment`,
   `ambiguous_legacy_id`, `invalid_date_range`, `invalid_enum`,
   `confirmation_required`, `duplicate_seq`). A service exception
   surfacing as "Unable to complete the MCP tool request" is a spec
   violation.
2. **Case-insensitive identity, return-existing creates.** Entities unique
   by name/code (Place by place+country, Airport by code) resolve
   case-insensitively. A create that matches an existing entity returns
   it with `created: false` — never an error, never a duplicate.
3. **`dryRun` on every mutating tool**, projecting exactly the counters
   and payload the real call returns.
4. **Idempotent retries.** Repeating a call with identical arguments has
   the effect of calling it once. Mutations return counters that
   distinguish `created` / `updated` / `unchanged`.
5. **No silent truncation.** List tools take `limit` (default 100, max 200) and `offset`, and return `total`, `limit`, `offset`, and
   `truncated: boolean`. Any aggregate with an internal top-N must say
   so the same way. (A silent top-20 truncation in finance took a
   dedicated fix round; don't repeat it.)
6. **structuredContent parity.** The structured result and the text body
   carry the same payload.
7. **Tool description house style.** Every tool's MCP description follows
   the existing servers' format: what it does, `Mode: read-only` or
   `Mode: write`, `Use when: …`, `Do not use when: …`, `Prerequisites: …`
   (where a lookup must be resolved first), `Produces: …` (ids the
   caller can chain into other tools). Match the tone of
   `possession_list` / `finance_transaction_upsert`.
8. **Write tools never auto-create referenced entities.** A segment
   create naming an unknown journey is rejected `unknown_journey`; a leg
   naming an unknown airport code is rejected `unknown_airport`. The one
   exception: `travel_place_create` is the explicit way to provision a
   place, and segment create takes a resolved `placeId` — name
   resolution is the caller's job via `travel_place_list`.
9. **Deletes are guarded and auditable.** Delete tools require
   `iUnderstand: true` (missing/false → `confirmation_required`, nothing
   deleted, no elicitation round-trip). A successful delete returns a
   snapshot of the deleted row(s). Deleting ids that don't exist reports
   them in `notFound`, never fatal. Deleting a journey defaults to
   refusing while it still has segments/legs/stays
   (`journey_not_empty`) unless `cascade: true` is also passed, in which
   case the snapshot includes every cascaded row.
10. **Validation is a tool, not a migration side-effect.** Data problems
    (§4) are reported by `travel_validate`, never auto-repaired by any
    tool in this spec.
11. **Audit + timestamps (pass 2).** Every entity carries `createdAt` /
    `updatedAt`, returned on every read. Every travel write (create,
    update, delete, merge, import row) appends to an append-only audit
    log in the pattern of the existing `possession_history` (creations,
    updates, status changes, archivals, deletions, with the fields that
    changed), readable via `travel_entity_history` (§7.7). A write that
    doesn't audit is a spec violation — Sheets has version history, and
    Hominem must not be a downgrade on "what changed?"
12. **Optimistic concurrency (pass 2).** Update and delete tools accept
    an optional `ifUpdatedAt`; if the row's current `updatedAt` differs,
    refuse with `version_conflict` and return the current row. Two
    agents editing the same journey must not silently lose each other's
    writes.
13. **Register travel entities in the generic plumbing (pass 2).** The
    server's generic tag tools (`entity_tags`, `tag_entity`,
    `untag_entity`) currently accept a closed `entityType` enum
    (`people`, `places`, `possessions`, `notes`). Extend it so travel
    entities are taggable (journey, segment, transport leg, stay,
    airport, travel place, idea, and — per §20 — residence — as
    distinct types). Warning: the
    existing `places` entity type means venue/restaurant places (see
    `place_visit_history`), which is **not** the travel Place entity —
    do not conflate them; name the travel one unambiguously and say so
    in the tool descriptions.
14. **Archive, don't just delete (pass 2).** Journey and Place carry an
    `archived: boolean` (default false), settable via their update
    tools, recorded in the audit log, and list tools take
    `archived: boolean` (default: include, matching
    `possession_list`'s behaviour — callers filter explicitly).

## 6. Tier 1 — read tools (build first; these replace the reference CLI)

All list filters are optional and combine as AND. All reads return both
`id` and `legacyId` for every entity (§3.4, §3.5). Sort orders below are
part of the spec.

### 6.1 `travel_journey_list`

Filters: `year` (matches startDate year), `purpose`, `from` / `to`
(journeys overlapping the range), `upcoming: boolean` (startDate ≥
today), `query` (name/notes text). Sort: startDate descending, nulls
last, legacyId as tiebreak. Returns journey summaries including derived
`segmentCount`, `places` (ordered segment place names), `countries`.

### 6.2 `travel_journey_get`

Input: `id` (uuid) or `legacyId` — exactly one. Returns the **dossier**:
the journey, its segments ordered by `seq` (each with nights derived
from arrival/departure), its legs ordered by date with airports resolved
per §3.1 (each leg returns `originCode`, `originName`, `originPlace`
(= servesPlace), same for destination, plus `distanceKm` per §8.1), and
its stays ordered by checkIn. This is the single most-used read; it must
need no follow-up calls.

### 6.3 `travel_segment_list` / `travel_segment_get`

List filters: `journeyId` / `journeyLegacyId`, `place` (name, resolved
case-insensitively), `from` / `to`. Sort: journey start, then `seq`.
Get returns the segment plus its departing/arriving legs (resolved per
§3.1) and its stays.

### 6.4 `travel_place_list` / `travel_place_get`

List filters: `status`, `country`, `type`, `query`, plus (§20)
`hasResidence: boolean` and `currentlyHome: boolean`. Sort: country,
then place. Every row includes the derived `relationships` object
(§2.4). Get returns the place **plus its visit history**: every segment
referencing it (journey legacyId + name, dates), so "when was he in
X?" is one call — **plus its residence records** (§2.8) with periods,
so "where has he lived, and when?" is the same call. If the place has
stored visited status but zero segments, include
`visitedWithoutSegment: true` (§4.2) in the get response rather than
hiding the conflict.

### 6.5 `travel_countries`

No inputs. Returns the segment-derived (§3.3) country list: for each
country, the sorted set of segment places, plus `countryCount`, and —
for transparency — `placesStatusCountryCount` and
`excludedByMethod` naming any country counted by Places status but not
by segments (on current data: exactly `Iceland`). Under §20,
`placesStatusCountryCount` counts a country if any canonical Place in
it has stored status `Visited` or `Lived in`, or has a residence
record — state the method in the payload as before.

### 6.6 `travel_transport_list`

Filters: `mode`, `carrier` (substring, case-insensitive), `from` / `to`
(each accepts a place name, city, or code — resolved per §3.1 against
code, servesPlace, and city), `journeyId` / `journeyLegacyId`,
`bookingRef`, `fromDate` / `toDate`. Sort: date ascending. Each row is
returned resolved (codes + names + servesPlaces) with `distanceKm`.

### 6.7 `travel_airport_list` / `travel_airport_get`

List filter: `place` (substring against servesPlace or city), `country`.
Each row includes derived `legCount` (legs using the code in either
direction). Get by `code` (case-insensitive) or `id`.

### 6.8 `travel_stay_list`

Filters: `city`, `segmentId` / `segmentLegacyId`, `journeyId` /
`journeyLegacyId`, `evidence`. Sort: checkIn ascending.

### 6.9 `travel_booking_lookup`

Input: `bookingRef` (case-insensitive), optional `partial: boolean`
(default false = exact match; true = substring). Searches Transport AND
Stays; returns both sections (either may be empty). This must find a
booking whether it's a flight or a hotel.

### 6.10 `travel_wishlist`

No inputs. Returns: places with status `Want to go` grouped by country
(with counts), stays with `evidence = want`, and open ideas of type
`experience`. Three sections, each labelled — do not merge them into one
undifferentiated list.

### 6.11 `travel_idea_list`

Filters: `status`, `type`. Sort: legacyId.

### 6.12 `travel_unresolved`

No inputs — the operator's triage view, combining: stays with
`evidence = thin`, ideas with `type = admin` and `status = open`, and
the current `travel_validate` summary counts (§7.3). Mirrors the
reference CLI's `unresolved` command.

## 7. Tier 1 (continued) — aggregates and integrity

### 7.1 `travel_stats`

No inputs (optional `year` filter). Returns, all segment-derived unless
labelled otherwise: `journeyCount`, `segmentCount`, `placeCount`
(visited places), `countryCount` (§3.3 method named in the payload),
`legCount` by mode, `totalDistanceKm` (§8.1, labelled as recorded-legs
only — most journeys predate systematic leg recording, so this is a
floor, and the payload must say so), `longestLeg` (codes, places, km,
date, journey legacyId), `longestJourneyByDistance`, counts by year,
and `firstTrip` / `latestTrip` (journey legacyId + dates). Never present
a Places-derived figure as a headline number.

### 7.2 `travel_search`

Input: `query`, optional `limit`. Global text search across journey
names/notes, place names, stay properties/cities, carriers, booking
refs, and idea text. Grouped results by entity type, each with `id` +
`legacyId`. This complements, never replaces, the filtered lists.

### 7.3 `travel_validate`

No inputs. Read-only integrity report; every check returns count + the
offending entity refs (`id`, `legacyId`, and a one-line detail):

- `orphan_segment` — segment whose journey doesn't exist (FKs should
  make this impossible; the check proves it)
- `orphan_stay` / `orphan_leg` — dangling segment/journey references
- `unknown_airport_code` — leg code missing from Airports
- `duplicate_legacy_id` — per entity type (§4.1: exactly T-004, T-005)
- `place_visited_without_segment` (§4.2: must include Reykjavik)
- `segment_place_missing` — segment place not found in Places
- `journey_date_inversion` / `segment_date_inversion` /
  `stay_date_inversion` — end before start
- `segment_seq_gap_or_dupe` — per-journey `seq` not a clean 1..n
- `stay_journey_mismatch` — stay's journeyId ≠ its segment's journeyId
- `thin_evidence_stays` — count + list (currently 3)
- `journey_overlap` — two journeys whose date ranges overlap (pass 2)
- `segment_overlap` — two segments (any journeys) whose date ranges
  overlap for the same place, or within one journey out of `seq` order
  vs dates (pass 2)
- `near_duplicate_leg` — two legs sharing date + origin + destination
  (+ number when both present) under different ids (pass 2)
- `near_duplicate_journey` — two journeys sharing startDate and first
  segment place (pass 2)
  On current data the expected result is in §12, item 7 — anything beyond it is
  either a bug in your import or a finding to report, not to fix silently.

### 7.4 `travel_timeline` (pass 2)

No inputs (optional `from` / `to`). One chronological stream across all
journeys: every segment (place, dates, nights, journey ref) interleaved
with the derived **home gaps** between a journey's end and the next
journey's start (gap duration in days). Under §20, each home gap is
**labelled with the home place** (place + period ref) by these rules,
in precedence order: (1) an `ongoing` period labels every gap at or
after its start; (2) a period with an explicit `endDate` labels gaps
inside [startDate, endDate]; (3) a month/year-precision period labels
only gaps inside its named month/year; (4) a day-precision period
with no recorded end and `ongoing: false` labels gaps after its start
until the next day-precision period's start, flagged
`inferred: true` (its note is the evidence; the end was never
recorded, so the label is an inference and must say so). No rule
matching → `home: null` — gaps before the earliest residence record
are unlabelled, never back-filled by guessing. On current data this
yields: gaps in 2018–Sep 2026 → Los Angeles (rule 4, inferred; the
Jan 2017 London month still wins for gaps inside Jan 2017 by rule 3's
precedence), gaps from 2026-09-23 → London (rule 1). This is the view
the sheet cannot produce — time away vs time home, in order.

### 7.5 `travel_insights` (pass 2)

No inputs (optional `year`). The rankings a sheet can't compute:
`daysPerPlace` and `nightsPerPlace` (summed from segment dates),
`daysPerCountry`, `mostVisitedPlaces` (segment count, then days),
`frequentRoutes` (leg origin→destination pairs by count, resolved per
§3.1), `legsByCarrier`, `travelDaysPerYear`, `longestStay` (segment),
`longestHomeGap`, and `nextTrip` (nearest future journey summary +
days until start). All counts segment-derived per §3.3; any top-N
obeys §5.5 (return `total` + `truncated`). Plus (§20) a `homes`
section: every residence record (place, periods, total recorded days
with precision caveats stated where a period's precision is month or
its end is unrecorded) and `currentHome` (the place whose period is
ongoing — on current data: London, since 2026-09-23).

### 7.6 `travel_distance` (pass 2)

Inputs: `origin`, `destination` (codes). Returns the haversine
`distanceKm` between any two Airports rows (§8.1 rules; null-able per
§8.1 when coordinates are missing), plus both resolved places. Utility
for planning legs that don't exist yet.

### 7.7 `travel_entity_history` (pass 2)

Inputs: `entityType` (journey | segment | transport | stay | place |
airport | idea), `id`, optional `limit` (default 50, max 100). The
append-only audit log for one entity, newest first, in the exact
pattern of `possession_history` (§5.11). Deleted entities' history
remains readable by id — the audit log outlives the row.

### 7.8 `travel_export` (pass 2)

Optional input: `format: native | sheet` (default `native`). Full dump
of all seven entities — native returns the §2 shapes; `sheet` returns
rows in the sheet's exact column names/order (Segments without the
dropped `destinations` column is fine and must be noted; Journeys'
`segments` string is regenerated from segment rows). Purpose: backup,
operator diffing against the sheet during the parallel-run period, and
proving the retirement of the sheet loses nothing. Restoring from an
export = feeding it to `travel_import` (§11); test that round-trip in
§12.

## 8. Derived distance

### 8.1 `distanceKm` on legs

Computed server-side from Airports latitude/longitude via haversine
(R = 6371 km), rounded to whole km. Not a stored, client-writable
field. If either endpoint lacks coordinates, return `distanceKm: null`
(never 0). Sanity anchors from the operator's earlier enrichment pass:
LAX→SYD ≈ 12,061 km, JFK→LHR ≈ 5,540 km, DFW→LAX ≈ 1,983 km (your
haversine should land within a few km of each). Current 41 legs total
≈ 125,700 km.

## 9. Tier 2 — single-entity write tools

All follow §5 (dryRun, idempotency counters, named errors, read/write
parity). All creates accept an optional client-supplied `legacyId`;
if omitted the server allocates the next in series (`JRN-`, `SEG-`,
`PLC-`, `T-`, `STY-`, `ARP-`, `IDA-` + zero-padded number). Allocation
must always produce an id not already present in that entity's table —
the §4.1 Transport duplicates are legacy data, not a pattern to extend.

- `travel_journey_create` / `travel_journey_update` /
  `travel_journey_delete` (§5.9 cascade rule)
- `travel_segment_create` / `travel_segment_update` /
  `travel_segment_delete` — create validates the journey exists and
  `seq` is free within it (`duplicate_seq`); deleting a segment does
  not renumber survivors (gaps are reported by validate, not hidden)
- `travel_transport_create` / `travel_transport_update` /
  `travel_transport_delete` — validates both airport codes exist,
  the journey exists, and any segment links belong to that journey
  (`segment_journey_mismatch`); a leg may be created with zero, one,
  or two segment links (§3.2 — all three are legal, never reject a
  boundary or layover leg for having "too few" links)
- `travel_stay_create` / `travel_stay_update` / `travel_stay_delete` —
  validates segment (and journey consistency, §7.3 check) at write time
- `travel_place_create` / `travel_place_update` — §5.2 return-existing
  on (place, country); status changes are explicit updates, never a
  side-effect of segment writes (a segment create must NOT silently
  flip a place to Visited or rewrite first/last visited — instead,
  place reads derive visit history from segments, and stored
  first/last are only refreshed by the import or an explicit place
  update; if you think this should be automatic, stop and flag it,
  don't just build it)
- `travel_airport_create` / `travel_airport_update` — §5.2
  return-existing on code; coordinates optional
- `travel_idea_create` / `travel_idea_update` — including the
  open → done transition as a normal update

### 9.1 Pass-2 write tools — the ones that make the sheet unnecessary

- `travel_journey_save` — **the centrepiece.** Atomically upserts a
  complete dossier in one call: the journey, its segments, its legs,
  and its stays (each section an array of §2-shaped objects, referenced
  within the payload by legacyId or by payload-local keys you define
  and document). All-or-nothing: any validation failure (unknown
  airport, unknown place, date inversion, segment/journey mismatch)
  rolls the whole save back and returns the named reasons per section.
  Follows §5 throughout (dryRun projects the full per-section
  created/updated/unchanged counters). Rationale: "log this trip" is
  the domain's real write workflow; forcing the caller to orchestrate
  10+ single-entity calls invites exactly the half-written journeys
  this tool exists to prevent. Single-entity tools remain the path for
  corrections.
- `travel_journey_clone` — inputs: source `id`, optional overrides
  (`name`, `startDate` — segment/leg/stay dates shift by the same
  delta; bookingRefs are **cleared**, never copied). Creates a full
  draft copy with fresh ids and fresh legacyIds. For "same trip as
  last year" planning.
- `travel_segment_reorder` — inputs: `journeyId`, `order` (the complete
  list of segment ids in their new order). Atomic seq reassignment —
  the only legal way to reorder, since naive per-row seq updates trip
  `duplicate_seq`. Rejects an incomplete or foreign-segment list
  (`invalid_order`).
- `travel_segment_merge` — `fromSegmentId` into `intoSegmentId` (same
  journey only, `segment_journey_mismatch` otherwise): repoints stays
  and leg dep/arr links, widens the survivor's dates to min/max,
  concatenates notes, deletes the emptied segment (snapshot returned),
  and leaves `seq` gaps for validate to show (no silent renumber).
- `travel_place_delete`, `travel_airport_delete`, `travel_idea_delete`
  — the deletes Tier 2 missed. Place/airport deletes refuse while
  referenced (`place_in_use` / `airport_in_use`, with the referencing
  counts) — the caller merges (§10) or repoints first. Idea delete is
  unguarded beyond §5.9.
- `travel_place_refresh` — the **explicit** counterpart to §3.3:
  recomputes every Place's stored `status` / `firstVisited` /
  `lastVisited` from Segments and reports the full diff
  (`{ place, field, stored, derived }[]`). With `dryRun: true` (the
  default for this tool) it changes nothing; with `dryRun: false` it
  applies exactly the reported diff. It must never run as a side-effect
  of any other tool, and on current data its dry-run diff must include
  the Reykjavik row (§4.2) — the operator then decides; if he applies
  it, that's his correction, recorded in the audit log.
- `travel_transport_get` / `travel_stay_get` — single-entity gets by
  `id` or `legacyId` (transport obeys §3.5 ambiguity), closing the
  parity gap with segment/place/airport gets.
- **Reparenting via update (rule, not new tools):** `segment_update`
  may change `journeyId` (target journey validated, `seq` required in
  the same call), `stay_update` may change `segmentId` (journeyId is
  re-derived and must agree), `transport_update` may change
  `journeyId` + segment links together. All reparenting validates the
  §7.3 consistency checks at write time and audits old → new parent.

## 10. Tier 3 — maintenance

- `travel_place_merge` — `from` (id or name) into `into`: repoints all
  segments and updates any other references, returns
  `{ segmentsRepointed }`, then deletes the emptied place row and
  returns its snapshot. Refuse merging a place into itself
  (`invalid_merge`). This exists because place vocabulary drifts
  (city vs country rows, §2.4) — build it, but nothing in the import
  may use it automatically.
- `travel_airport_merge` — `from` code into `into` code: repoints all
  legs' origin/destination, returns `{ legsRepointed }`, deletes the
  emptied airport row (snapshot returned). For code corrections and
  real-world replacements (a defunct field superseded by a new one).
  Nothing in the import may use it automatically.
- `travel_import` — §11. (Tier 1 in build order, listed here because
  it's a write.)

Explicit non-goals for all tiers: no place/stay/segment auto-repair,
no automatic visited-status reconciliation (§3.3/§4.2), no geocoding
(coordinates come from the source data or an explicit airport update),
no attendee model (the legacy `trip_history` has attendees; the sheet
model doesn't — do not invent one), no currency/cost fields (this
domain has no money), no Google Sheets runtime access anywhere.

## 11. The import (`travel_import`)

Migration tool in the pattern of `finance_transactions_import` — and,
after cutover, the domain's permanent bulk-upsert path (pass 2): the
same tool that imports the sheet is how a caller later writes 30 legs
at once. Do not hard-code anything migration-specific (dates, counts,
one-off flags) into it:

- **Input:** `rows` grouped by entity (`places`, `journeys`, `segments`,
  `transport`, `stays`, `airports`, `ideas` — arrays of sheet-shaped
  objects with the sheet's column names), `mode: append | replace`,
  `dryRun: boolean`.
- **Reference resolution:** segments resolve `place` (name) → Place and
  `journey_id` (legacy) → Journey; transport resolves segment legacy
  ids and journey legacy id; stays likewise. Unresolvable references
  reject that row with a named per-row `reason`
  (`unknown_place`, `unknown_journey`, …) and never fail the batch.
- **Places routing (§20):** the `places` array accepts a new optional
  `residences` sibling array, and sheet-shaped `places` rows with
  `status = Lived in` are **diverted**: each becomes a Residence
  record (§2.8) attached to the canonical Place of the same
  (place, country) — created from the non-`Lived in` row when present
  (the current data always has one), or, if a place has ONLY a
  `Lived in` row, that row becomes the canonical Place (keeping stored
  status `Lived in`) AND gets its Residence record; count it in the
  result as `residenceOnlyPlaces`. Import counters therefore report
  Places and Residences as separate lines (§12 as amended). A second
  `places` row whose (place, country) matches an existing Place in any
  other status is a genuine duplicate: reject it `duplicate_place`
  rather than guessing — the `Lived in` diversion is the only
  exception, and it is structural, not a guess.
- **Idempotency keys:** `legacyId` for every entity **except**
  Transport, which uses the §4.1 composite
  `(legacyId, journeyLegacyId, date, origin, destination)`.
  Re-running the full import in `append` mode must converge to
  `created: 0, updated: 0, unchanged: <all>`.
- **`replace` mode** requires `iUnderstand: true`
  (`confirmation_required` otherwise) and reports a pre-delete count
  snapshot per entity.
- **`segments.destinations` and `journeys.segments`** columns are
  dropped (§2.1/§2.2) and the drop is reported in the result
  (`droppedColumns`), not done silently.
- **Result:** per-entity counters
  `{ created, updated, unchanged, rejected: [{ legacyId, reason }] }`
  plus `droppedColumns`. The operator will diff these counters against
  §12's ground truth exactly.
- Order of application inside a batch: airports → places → journeys →
  segments → transport → stays → ideas, regardless of key order in the
  payload.

## 12. Appendix — ground truth (live sheet, verified 2026-10-15)

Your import and read tools are accepted against these numbers, exactly:

| tab       | rows           | breakdown                                                                                                                                                                                      |
| --------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Places    | 81 source rows | status: Visited 48, Want to go 31, Lived in 2 — under §20 the 2 `Lived in` rows import as Residence records: canonical Places created = 79, Residences created = 2, source rows preserved = 81 |
| Journeys  | 53             | purpose set on only 8 (business 3, leisure 3, mixed 1, move 1); 45 blank                                                                                                                       |
| Segments  | 62             | across all 53 journeys; every segment place exists in Places                                                                                                                                   |
| Transport | 41             | air 38, rail 3; exactly 1 leg with neither segment link (T-026)                                                                                                                                |
| Stays     | 53             | evidence: email 38, calendar 6, want 6, thin 3                                                                                                                                                 |
| Airports  | 30             | all 30 carry latitude/longitude                                                                                                                                                                |
| Ideas     | 16             |                                                                                                                                                                                                |

Worked examples (your code must reproduce all of these):

1. **JRN-042** `Australia — Mar 2024`, 2024-03-10 → 2024-03-28, leisure.
   Segments: SEG-020 Sydney (seq 1, Mar 10–17), SEG-021 Melbourne
   (seq 2, Mar 17–22), SEG-006 Byron Bay (seq 3, Mar 22–27),
   SEG-022 Sydney (seq 4, Mar 27–28).
   Legs: T-003 LAX→SYD (Mar 10, arr-only), T-004 SYD→MEL (Mar 17,
   VA842, `KWGLMJ`), T-005 MEL→BNK (Mar 22, JQ464, `NLEVSZ`),
   T-006 BNK→SYD (Mar 27), T-007 SYD→LAX (Mar 28, dep-only).
   BNK resolves to place **Byron Bay** everywhere.
2. **JRN-048** `Cincinnati — 2026-11`, Nov 25–29 2026, SEG-117
   Cincinnati. Legs: BA121 LHR→CVG Nov 25 and BA120 CVG→LHR Nov 29,
   both booking `YQUQ9J`. (These are the duplicate T-004/T-005 of §4.1.)
3. **Booking `HA6FQZ`** → exactly 2 transport rows, 0 stays:
   LAX→CVG 2026-07-16 and CVG→LAX 2026-07-20, journey JRN-047.
4. **Booking `YQUQ9J`** → exactly the 2 JRN-048 legs above (a booking
   lookup must not confuse them with JRN-042's T-004/T-005 despite the
   shared legacy ids — refs differ, and that's the point of §4.1).
5. **Countries** → segment-derived count **10**; `excludedByMethod`
   = [Iceland]. Places-derived count 11 must never be the headline.
6. **Airports** → BNK: name `Ballina Byron Gateway Airport`,
   servesPlace `Byron Bay`, city `Ballina`, country `Australia`.
   KEF: servesPlace `Reykjavik`, notes contain `layover only`.
7. **Validate on imported current data** must report:
   `duplicate_legacy_id` = exactly T-004 + T-005 (Transport only);
   `place_visited_without_segment` includes Reykjavik;
   `thin_evidence_stays` = 3 (STY-045 Boston, STY-046 Bridport,
   STY-047 Boston); zero orphan segments/stays/legs; zero unknown
   airport codes; zero date inversions. Any additional finding must be
   reported to the operator with evidence before acceptance — it is
   either an import bug or a genuine new finding, and the operator
   decides which.
8. **Distance** → total across the 41 recorded legs ≈ 125,700 km
   (±1% for rounding); LAX→SYD within a few km of 12,061 km.
9. **`trip_history` compatibility** — the existing tool keeps working
   unchanged throughout. Do not modify, rename, or deprecate it in
   this job; a later job may re-point it at the new store, and that
   decision is the operator's, not yours.

Pass-2 acceptance (all live, all must pass):

10. **Whole-journey save.** `travel_journey_save` a synthetic 2-segment
    journey with 3 legs and 2 stays in one call → all rows readable via
    the Tier-1 gets; re-save identically → all counters `unchanged`;
    save a variant with one unknown airport code → the entire save is
    rejected `unknown_airport` and **zero** rows from it exist after.
11. **Export/import round-trip.** `travel_export` (native) → feed the
    export to `travel_import` in append mode → counters
    `created: 0, updated: 0`, unchanged = §12 totals; `format: sheet`
    export diffs clean against the live sheet except the two known
    dropped columns.
12. **Audit.** Create, update, and delete a synthetic idea →
    `travel_entity_history` shows all three events in order with the
    changed fields, and the deleted idea's history is still readable.
13. **Deletes that were missing.** Prove `travel_place_delete`'s
    `place_in_use` refusal on a synthetic place referenced by a
    synthetic segment, and its success path on a synthetic unreferenced
    place. Do **not** run it on Reykjavik: zero segments reference it,
    so the delete would succeed — and §4.2's discrepancy must survive
    acceptance intact for the operator to decide. Same synthetic-only
    pattern for `travel_airport_delete` (`airport_in_use`), plus a real
    `travel_idea_delete` on a synthetic idea.
14. **Reorder + merge.** On a synthetic 3-segment journey:
    `travel_segment_reorder` reverses the order atomically (no
    `duplicate_seq` possible); `travel_segment_merge` folds two
    segments, stays/legs repointed, survivor dates = min/max.
15. **Refresh dry-run.** `travel_place_refresh` with default dryRun →
    diff includes Reykjavik's stored-vs-derived status and changes
    nothing (place read-back identical before/after).
16. **Timeline + insights sanity.** `travel_timeline`'s first home gap
    and `travel_insights`' `daysPerCountry` must be consistent with
    §12's segment set (spot-check Australia: segments in example 1
    aggregate to Sydney 8 nights across its two segments, Melbourne 5,
    Byron Bay 5); `nextTrip` =
    JRN-048 (Cincinnati, 2026-11-25) as of any run date in Oct 2026.
17. **Tagging registration.** After §5.13 lands, `tag_entity` +
    `entity_tags` round-trip a tag on a journey and on a travel place,
    and the travel place type is provably distinct from the venue
    `places` type.

## 13. Build order

1. Schema + entities (§2) with FKs per §7.3's orphan checks, audit
   log + timestamps (§5.11), and the §5.13 entity-type registration.
2. `travel_import` (§11) + import the live sheet data; counters must
   match §12 before any read tool is accepted.
3. Tier-1 reads (§6) + aggregates/validate (§7) + distance (§8).
4. Live acceptance (§12 items 1–9) run by the operator against
   production data.
5. Tier-2 writes (§9) + pass-2 write tools (§9.1), then Tier-3
   merges (§10).
6. Pass-2 acceptance (§12 items 10–17). The sheet is retired only
   after step 6 passes and the operator says so — not before, and not
   by you.

## 14. How to report back

When done (or blocked), report in this shape: tools built (name +
one-line behaviour), the import counters per entity vs §12, the full
`travel_validate` output, §12 worked examples 1–17 pass/fail each, and
anything you found that contradicts this spec — quoted, with the live
evidence — rather than a silent workaround. If a section of this spec
conflicts with the existing codebase's patterns, follow the codebase
pattern and flag the divergence in your report; do not silently fork
the conventions in §5.

## 15. Decisions reserved for the operator — surface, do not build (pass 2)

A sheet-parity audit found three things the legacy `trip_history` or
the real world has that the sheet model (§2) deliberately lacks. They
are **out of scope** for this job. If your implementation keeps
tripping over one, note it in your report; do not model it on your own
authority:

1. **Attendees.** `trip_history` returns attendee names; no sheet tab
   has them. Modelling companions per journey/segment is a product
   decision (and a privacy-shaped one), not a migration detail.
2. **Home-base periods.** Journeys are home-to-home arcs, and home
   itself moved (Los Angeles → London, Sep 2026). "Time at home" stats
   (§7.4 gaps) are computed from journey boundaries only; a first-class
   home-period model (which place was home, from when to when) would
   sharpen them, but inventing it is the operator's call.
   **(Decided 2026-10-16 — the Residence model, §20. No longer
   reserved.)**
3. **Money and documents.** No costs, no booking-confirmation files, no
   attachment links exist in the source model. Finance lives in
   `finance_*`; documents live elsewhere. Do not grow either into
   travel unprompted.

## 16. Preflight decision — existing travel tables (2026-10-15, operator-approved)

Your schema preflight found `app.travel_trips` (108 rows),
`app.travel_segments` (91 legacy calendar/transport rows), and
`app.travel_trip_attendees` (71 rows) already in the database, with
`trip_history` reading trips/attendees. Decision: **Option 1 — preserve
and isolate.** Specifically:

1. **Old tables are frozen legacy.** Do not rename, alter, drop, or
   write to `travel_trips`, `travel_segments`, or
   `travel_trip_attendees` in this job. No data moves between the
   legacy tables and the new model in either direction.
2. **The new stop table is `app.travel_journey_segments`.** MCP tool
   names are unchanged (`travel_segment_*`) — table names are internal,
   the tool surface is the API, and the journey prefix is the more
   precise name anyway: a segment is defined by its parent journey.
3. **Apply the same pattern proactively:** before creating any new
   travel table, collision-check its natural name; on any collision or
   genuine ambiguity, use the journey-/domain-prefixed variant rather
   than renaming an existing table, and list every final table name in
   a preflight addendum in your report **before** the migration runs.
4. **`trip_history` baseline:** before your first schema change,
   capture `trip_history` output (default call and `limit: 50`) as a
   baseline snapshot; after the build, diff against it — §12 item 9's
   "keeps working unchanged" means byte-identical results, not merely
   "still responds". (Operator's own live sample, 2026-10-15: the
   capped call returns 50 trips, startDates 2019-12-21 → 2025-10-09,
   31 of the 50 carrying attendee names.)
5. **Attendees stay stranded-by-design for now.** The 71 legacy
   attendee rows remain readable only via `trip_history`. That is
   §15 item 1 working as intended — the operator decides the attendee
   model later, with the legacy data preserved intact for that
   decision. Your final report must include a one-line reminder that
   this data exists only in the legacy tables.
6. **Do not reconcile legacy rows into the new model.** The legacy
   trips are a different, older model (per-city trip records) and
   contain known errors the sheet model already corrected — e.g. both
   `Ballina` and `Byron Bay` exist as separate legacy trips, which is
   exactly the §3.1 confusion the new model resolves via BNK's
   servesPlace. The sheet's 53 journeys were already reconciled
   against these legacy trips by the operator on 2026-10-07 (including
   5 trips imported into the sheet from Hominem at that time); that
   reconciliation is done and must not be re-run from the legacy side.

## 17. Authorization decision — `travel:write` scope (2026-10-15, operator-approved)

Preflight found the server defines `travel:read` and no `travel:write`.
Decision: **add a distinct `travel:write` scope. Read-only v1 is
rejected** — the import itself is a write, and without a write path the
sheet can never retire, which is the point of this project.

1. **Mirror the house pattern, don't invent one.** Before implementing,
   establish how the existing write domains are authorized (how are
   `finance_transaction_upsert`, `finance_transactions_import`,
   `possession_delete`, etc. scoped and checked today?) and follow
   that naming, enforcement point, and token-grant flow exactly. If
   you find the other write domains have **no** distinct write scope,
   say so explicitly in your preflight addendum before proceeding —
   that changes the token-issuance picture and the operator wants it
   stated, not smoothed over.
2. **Classification is by tool, not by invocation.** Every tool whose
   spec mode is `write` (§9 creates/updates/deletes, §9.1
   save/clone/reorder/merges/refresh, §10 merges, §11 import) requires
   `travel:write` — **including its `dryRun` invocations**. A dry-run
   flag is not a way to use a write tool on a read scope. Every
   read-mode tool (§6, §7 including `travel_validate` and
   `travel_export`) stays on `travel:read`. `trip_history` is
   unchanged and stays `travel:read`.
3. **Named refusal.** A write attempted without the scope returns the
   §5.1 named-error shape with reason `insufficient_scope`, naming the
   required scope — never a bare 403 and never "Unable to complete
   the MCP tool request". The targeted row(s) must be provably
   unchanged after a refused call.
4. **Annotations parity.** Set MCP tool annotations consistently with
   the existing write tools (e.g. `readOnlyHint: false`, plus
   `destructiveHint: true` on deletes/merges, `idempotentHint` where
   §5.4 holds) — travel tools must not be the unannotated outliers.
5. **Grant path is part of the deliverable.** The operator's existing
   MCP credential currently carries `travel:read`. Your report must
   state exactly how `travel:write` gets granted to that credential
   (ideally: scope added, no credential rotation, no re-issue) and
   verify post-rollout — with a `dryRun` write call and one synthetic
   write call — that the operator's existing connection can actually
   write. "Tools deployed" without a working grant for the operator's
   own token is not done.
6. **Acceptance additions (live, both must pass):**
   (a) With a read-scope-only token: every §6/§7 read succeeds; one
   representative create, one update, one delete, and one import
   dryRun are each refused `insufficient_scope`, and read-backs prove
   nothing changed.
   (b) With the write scope granted: the same four calls succeed
   (synthetic rows only), and `travel_entity_history` (§7.7) shows
   the writes were audited.

## 18. Source export provided (2026-10-15)

The reference CLI and a local source export were not present in your
environment, so the operator has attached the complete source data:
**`travel-export-package.zip`** (SHA-256
`533477ba44e01237d11c302f30f64e686edea8aa45195c37c29f7afc63c4b8a3`),
pulled live from the sheet on 2026-10-15. It contains
`travel-export.json` (all seven tabs; rows as objects keyed by the
sheet's exact column names; SHA-256
`0bfc59dd6ceb44846b3993893bb6cca66bd6b35c74d892d5550d66e76906e174`),
one CSV per tab, the `travel.py` reference CLI source (read it — it
documents Tier-1 read behaviour; it needs the operator's sheet access
and will not run in your environment), a `MANIFEST.json` with per-tab
counts/headers/checksums, and an `EXPORT-README.md`. Counts in the
export match §12 exactly (81 / 53 / 62 / 41 / 53 / 30 / 16 = 336 rows).
Build and verify the import **only** against this export — if a row
isn't in it, the row doesn't exist, and any gap you think you see is a
question for the operator, not a licence to invent data.

## 19. Decision — unlinked wishlist Stays (2026-10-16, operator-approved)

Preflight against the export found STY-048–STY-053 — all six
`evidence = want` stays — have blank `segment_id` and `journey_id`,
contradicting the links §2.5 originally required. The spec was wrong,
not the data: these are "dream stay" property wishes (Sea Ranch Lodge;
Drift and Azure Sky, Palm Springs; Glen Oaks, Deetjen's, and Andrew
Molera State Park, Big Sur) with no dates and no booking refs — no
journey exists for them, by design. Verified at decision time: exactly
these 6 of 53 stays have blank links, all are `want`, and **zero**
non-`want` stays have blank links. Decision: **Option 1 — allow
unlinked wishlist stays.** This section amends §2.5, §7.3, §9, and §11:

1. **Nullability rule.** `segmentId` / `journeyId` on a Stay are
   nullable **iff** `evidence = want`, and must be both null or both
   set — exactly one set is invalid. Enforce with a database CHECK
   constraint and with write validation: a non-`want` stay missing
   links is rejected `stay_links_required`; any stay with exactly one
   link is rejected `stay_links_partial`.
2. **Import (§11 amendment).** `want` rows with blank ids skip
   reference resolution entirely — never rejected
   `unknown_segment` / `unknown_journey`. Expected import result is
   unchanged: Stays created 53, rejected 0.
3. **Validate (§7.3 amendment).** `orphan_stay` and
   `stay_journey_mismatch` apply only to linked stays. Add a
   `stay_partially_linked` check (expected count on current data: 0).
   The six unlinked stays are **not** a validate finding.
4. **Reads.** Journey dossiers never include them (they have no
   journey). `travel_stay_list` returns them with null links (clients
   must handle nulls), the `evidence` filter finds them, and §6.10's
   wishlist stays section is exactly these six rows.
5. **Linking later is the lifecycle.** Setting both links on a `want`
   stay (via `travel_stay_update`) is how a dream stay becomes a
   planned stay; changing `evidence` away from `want` on an unlinked
   stay is rejected `stay_links_required`.
6. **Round-trip (§12 item 11 amendment).** `travel_export` in sheet
   format must regenerate blank `segment_id` / `journey_id` for these
   six rows — nulls survive the round-trip, no placeholder values.
7. **Rejected alternatives, for the record.** Excluding the six rows
   (option 2) loses real data and fails the lose-nothing retirement
   criterion. Revising the export (option 3) means inventing journeys
   or segments to hold them — fabricating trips that never happened,
   and a fabricated Big Sur or Sea Ranch segment would then pollute
   every segment-derived visited/country statistic (§3.3). Never
   manufacture structure to satisfy a schema; loosen the schema to
   fit the truth instead.

## 20. Decision — duplicate Places are Residences (2026-10-16, operator-delegated)

The operator was offered four policies for the London / Los Angeles
duplicate Place rows and delegated the choice: _"choose the best
option that enables us to adequately CRUD these multidimensional
facts of life."_ Decision: **Option C — canonical Place + Residence
records**, as designed in §2.4/§2.8 and the amendments already folded
into §5.13, §6.4, §6.5, §7.4, §7.5, §11, and §12. This section is the
decision record; where it and an earlier clause disagree, this section
wins and the earlier clause should already have been amended to match.

### 20.1 Why (one paragraph, for the report)

A place is one entity; visited, wanted, and lived-in are independent
dimensions of the operator's relationship with it, and residence is a
fact with **periods** (London: Jan 2017, and Sep 2026–present; Los
Angeles: 2016 → Sep 2026). Merging the rows (Option A) destroys the
residence dimension and misstates dates. Keeping duplicates (B/D)
leaves every place lookup ambiguous forever. Only C preserves every
source field, restores absolute (place, country) uniqueness, makes
all 6 name-only Segment references resolve to the single place they
always meant (verified: SEG-002/050/057/098 London, SEG-018/100 Los
Angeles — all physical stays; a Segment never targets a residence),
and gives the residence dimension real CRUD instead of a status
string. This also closes §15 item 2 (home-base periods) — decided,
no longer reserved.

### 20.2 Import behaviour (recap of §11 as amended)

81 Places source rows → **79 canonical Places + 2 Residence records**
(PLC-048 → London residence, PLC-047 → Los Angeles residence, periods
exactly as tabulated in §2.8). Segment name resolution now has exactly
one possible target per (place, country); the §11 ambiguity concern
that raised this question cannot recur. Re-import converges:
residences are idempotent on their `legacyId` like everything else.

### 20.3 Residence CRUD — 5 new tools (total travel tools: 59)

All follow §5 and §17 (`travel:write` for mutations incl. dryRun;
audit via §5.11; entity history entityType gains `residence`):

- `travel_residence_list` — filters: `placeId` / `place` (name),
  `current: boolean` (has an ongoing period). Returns records with
  their periods and the canonical place summary.
- `travel_residence_get` — by `id` or `legacyId`.
- `travel_residence_create` — inputs: `placeId` (must exist —
  `unknown_place` otherwise; provision the place first via
  `travel_place_create`), `periods` (≥1, validated per §2.8:
  `invalid_period` for endDate < startDate or ongoing with an endDate;
  `multiple_current_homes` if an ongoing period would collide),
  `notes`. §5.2 return-existing on `legacyId` when supplied.
- `travel_residence_update` — replace `periods` wholesale and/or
  `notes` (the audit log records the period diff); same validations.
- `travel_residence_delete` — §5.9 guarded; returns the snapshot.
  Deleting a residence never touches its Place.

### 20.4 Export amendment (§7.8)

`travel_export` gains an eighth entity, `residences`. In `sheet`
format, the Places tab is regenerated to the full **81 rows**: the 79
canonical places plus one re-emitted row per residence record, built
from `legacyId`, the canonical place's name/country/type,
`status = Lived in`, `sourceFirstVisited` / `sourceLastVisited`, and
the residence `notes` — byte-comparable with the source export (§18)
modulo the two known dropped columns elsewhere. The §12 item 11
round-trip acceptance extends to this: sheet-format Places diff
against the source export must be empty.

### 20.5 Acceptance additions (live, all must pass)

18. **Resolution.** All 6 London/Los Angeles segments resolve to
    PLC-018 / PLC-019 respectively; no import row is rejected for
    place ambiguity; import counters show Places 79 created +
    Residences 2 created from the 81-row source.
19. **Place get.** `travel_place_get` London returns
    `relationships: { visited: true, segmentCount: 4, livedIn: true,
    currentlyHome: true, wantToGo: false }` and both residence
    periods (Jan 2017 at month precision; 2026-09-23 ongoing). Los
    Angeles: `livedIn: true, currentlyHome: false`, segmentCount 2.
20. **Residence CRUD round-trip.** Create a synthetic residence on a
    synthetic place → get → add a second period via update → delete;
    audit history shows all events. Creating a second ongoing period
    anywhere is refused `multiple_current_homes`.
21. **Timeline labelling.** Per §7.4's rules: a home gap in
    Oct 2026 is labelled London (ongoing period, not inferred); a gap
    in 2024 is labelled Los Angeles with `inferred: true`; a gap
    inside Jan 2017 is labelled London (month-precision period beats
    the inferred Los Angeles range); a gap before 2016 is
    `home: null`.
22. **Export parity.** Sheet-format export's Places tab has exactly
    81 rows and diffs empty against the §18 source export's Places
    tab.

## 21. Updated prompt + Residence data provided (2026-10-16)

Your local copy of this prompt is stale — it predates §§16–20. The
current file (this one) is the only operative spec: it runs §§0–22,
contains §2.8 (Residence model + the exact migrated periods), §5
item 13 (tagging registration — cited elsewhere as §5.13), and
§§20.1–20.5 (decision, import behaviour, the five
`travel_residence_*` tool contracts, the export amendment, and
acceptance items 18–22). Discard the older copy; if a section number
cited in an operator message doesn't exist in your file, your file is
the problem, not the citation.

On the export: there is **no Residence tab in the source sheet and
there never was** — residences are derived at import from the two
`Lived in` Places rows (PLC-047/048), which ARE in the §18 export's
Places tab. To remove all interpretation risk, the operator has
attached **`residences.json`**: the two residence records in
`travel_import`'s input shape, derived from those rows exactly as
§2.8 tabulates (period precision, ongoing flags, and notes verbatim;
no invented dates). Treat it as authoritative import input for the
residences entity, alongside `travel-export.json` for the other
seven. Both files ship together in the v2 package.

## 22. Production acceptance, overlap, and cleanup decision (2026-10-16)

The acceptance gate remains deployed and live. Local MCP acceptance is a
pre-gate only; it does not replace acceptance against production data, and
the local-substitute option is rejected. Run Residence acceptance items
20 and 22 after the T-006/T-007 capabilities land; this is an execution-order
change only. All live acceptance is against the deployed production MCP
endpoint `https://api.ponti.io/api/mcp` and production data, by the operator.
Deployment credentials beyond the endpoint will be provided directly by the
operator; do not seek or infer them from local secrets.

Overlap disposition:

1. The legacy tables frozen by §16 are not overlap candidates. Never touch,
   deduplicate, or move data to or from those tables.
2. Rows already in the new `travel_*` tables converge through §11 idempotent
   upsert on `legacyId` (Transport uses its specified composite key). An
   overlap is never a reason to create a duplicate.
3. Before measuring the acceptance import, list and remove synthetic/test
   rows left by earlier tasks so the counters represent the real import only.
   Preserve the immutable source export and all §16 legacy tables.

--- PROMPT END ---
