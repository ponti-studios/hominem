# Place and Travel data design

**Status:** Current design authority, revised 2026-10-17. This document
supersedes the original sheet-era Travel schema and tool prompt. Historical
source IDs and row counts are migration evidence only; they are not current
database identity or product semantics.

## 1. Product model

Hominem lets a person discover places, save places, and record independent
relationships and events involving those places. A physical location has one
canonical Place record per owner. Travel, visits, and lived-in history are
separate relationships with their own lifecycles.

| Concept          | Meaning                                                                                         | Identity / relationship                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Place**        | A saved location belonging to a person                                                          | `app.places`; owner-scoped UUID                                                                |
| **Travel place** | The person's travel-specific relationship to a Place, including travel intent and archive state | `app.travel_places`; unique `(owner_userid, place_id)`                                         |
| **Journey**      | A planned or completed home-to-home trip                                                        | Owner-scoped UUID                                                                              |
| **Journey stop** | One ordered occurrence at a Place within a Journey                                              | Belongs to a Journey; references canonical Place; repeated stops at the same Place are allowed |
| **Transport**    | A leg between transport endpoints, optionally linked to the stop it departs from and arrives at | Belongs to a Journey; distinct from Journey stops                                              |
| **Visit**        | A dated/provenanced visit to a Place                                                            | References `app.places`; independent from itinerary structure                                  |
| **Residence**    | The fact that a person has lived at a Place                                                     | One parent per owner and Place, with one database row per lived-in period                      |
| **Stay**         | Lodging evidence, planned or historical                                                         | Optional links to Journey and stop, according to evidence type                                 |

A Journey stop is part of an itinerary but occurs at a Place. A Residence is
not Travel data: it records where a person has lived and remains meaningful
without any Journey. A Visit is an occurrence, not a Place classification.
Do not encode these concepts as one status field on Place.

## 2. Canonical Place and relationships

### 2.1 Place

`app.places` is the canonical, private, owner-scoped location record used by
all domains. It holds location facts such as name, country, type, address,
coordinates, personal notes, and source identity references. Existing Place
UUIDs and owner scope are preserved during migration.

Names, country, type, and nearby coordinates are not sufficient proof that two
Place records represent the same location. Do not merge on those attributes.
When provider identity exists, store it as a provider-qualified source
reference, unique by `(owner_userid, provider, provider_place_id)`. Otherwise,
preserve separate Places until a user or operator explicitly reconciles them.

Worldwide discovery uses a privately operated OpenStreetMap-derived search
index, separate from the transactional personal database. Do not use public
Nominatim for product autocomplete or production traffic. Store only the
selected, permitted normalized facts and source attribution needed for the
user's saved Place. Keep source facts distinct from personal notes and
relationships. OurAirports remains an independent airport reference source.

### 2.2 Travel place

`app.travel_places` is a real owner-scoped relationship table, not a second
copy of Place. It references `app.places` with an owner-safe foreign key and
has a unique `(owner_userid, place_id)` constraint. It holds only Travel state,
such as `want_to_go` and travel-list archive state. A Place may exist without a
Travel-place relationship, for example when it is used only by a Visit or
Residence.

### 2.3 Journey stops, transport, and visits

A Journey stop has a Journey, sequence, canonical Place reference, arrival
and departure dates, and stop-specific notes. `(journey_id, seq)` is unique,
but two different stops may reference the same Place. A stop does not require
the Place to be on the user's Travel list. Stops must not be confused with
transport legs.

Transport is a leg between endpoints. Air endpoints resolve through the
airport reference/curation model in §5. Rail endpoints retain station-code
behavior until a separate station catalogue is approved. A transport leg may
link its departure and arrival to stops; those links determine itinerary
context, but the leg itself is not a Place visit.

A Visit references `app.places` directly and records its own date and
provenance. Journey stops can inform derived visit summaries. An explicitly
recorded Visit must not be counted twice when deriving those summaries.

### 2.4 Residence and period rows

Residence is outside the `travel_*` entity family. Use Place-domain operations
(`place_residence_*`) and export it with Place relationships. Enforce one
Residence parent per `(owner_userid, place_id)`. Store each lived-in interval
as a row in `app.place_residence_periods`, with start date, nullable end date,
ongoing flag, precision, and note. Do not store a JSON array of periods.

For API responses, sort the period rows deterministically and group them into
the Residence `periods[]` array. Example: a London Residence can have one row
for January 2017 with an unknown end and `ongoing = false`, plus another row
from 2026-09-23 with `ongoing = true`. An unknown end does not mean ongoing;
never invent an end date or ongoing state. At most one ongoing period may
exist for a person across all Places.

The source value `Lived in` is import vocabulary only. It is never persisted
as Place status or Travel-place status. Derive `livedIn` / `currentlyHome`
summaries from Residence and period rows.

### 2.5 Integrity, ownership, and query behavior

- Personal tables have row-level security and owner-safe foreign keys.
- A Travel-place references a Place owned by the same user; Journey stops,
  Visits, and Residences reference canonical Places owned by that user.
- Enforce one Travel-place per Place, one Residence per Place, unique stop
  sequence per Journey, and no more than one ongoing Residence period per
  person.
- Index owner-scoped Place lists and lookups, provider identities, Journey
  stops by Journey/sequence and Place/date, and Residence periods by parent and
  dates. Add text/nearby search indexes only where supported by the installed
  database extensions and measured query needs.
- Keep Place search index/source data separate from personal Place rows and
  never expose another owner's notes or relationship state.

## 3. Identity and import/export

UUIDs are the persisted entity identities. No Travel table or tool allocates
or returns sheet `legacyId` values. Existing UUIDs remain unchanged for rows
whose entity identity is unchanged. Audit history is append-only: preserve old
snapshots as recorded, while new snapshots use UUIDs and omit legacy IDs.

Native export includes UUIDs and all references required for an exact
round-trip. `travel_export` is native-only; the archived Sheet export is not a
current output format. Source identifiers in an import are payload-local
aliases used only to resolve references within that payload. They are never
stored as entity identity.

Use these identity rules for import and id-less write convergence:

| Entity       | Matching rule                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Place        | UUID or provider-qualified source identity. Otherwise create a distinct Place or request explicit reconciliation; never infer identity from name/country or coordinates. |
| Travel place | `(owner_userid, place_id)`                                                                                                                                               |
| Journey      | UUID or exact `(owner_userid, name, startDate, endDate)`                                                                                                                 |
| Journey stop | UUID or `(journey_id, seq)`                                                                                                                                              |
| Transport    | UUID or exact Journey, date, origin, destination, carrier, and number tuple                                                                                              |
| Stay         | UUID or `(segment_id, property, checkIn)`; unlinked wishlist stays use their documented owner-scoped property/city key                                                   |
| Residence    | UUID or `(owner_userid, place_id)`; period rows are matched by UUID or explicit migration mapping, not dates alone                                                       |
| Idea         | UUID or an owner-scoped key with matching database uniqueness semantics                                                                                                  |

The archived source export contains 336 rows across the former Travel entities.
Its baseline is 81 Place rows (79 non-residence Places plus two `Lived in`
rows), 53 Journeys, 62 stops, 41 Transport legs, 53 Stays, 30 airport
curation rows, and 16 Ideas. The two residence source rows are PLC-048
(London) and PLC-047 (Los Angeles). Those source IDs and counts are migration
evidence, not current database identities. Existing transport duplicate
source IDs T-004 and T-005 refer to distinct legs and must not cause those
legs to be merged.

If a source Place has neither UUID nor provider identity, repeated import
cannot safely infer that it is the same real-world location. Surface the
ambiguity or require a stable mapping. This preserves data while avoiding
silent false merges. Other id-less aggregate writes converge according to the
entity matching rules above and reject ambiguous Place references.

## 4. MCP ownership and authorization

Travel tools read and mutate Journeys, stops, transport, stays, Travel-place
relationships, ideas, airport curation, and Travel aggregates. Reads require
`travel:read`; mutations require `travel:write`, including dry-run calls.
Residence operations belong to the Place domain and use `place_residence_*`.
No tool mutates the OurAirports reference dataset.

Every mutation is owner-scoped, validated, and recorded in audit history.
Multi-row operations are atomic. Dry-run returns the same projected counters
and validation result as a real operation without persisting rows or audit
events. Confirmed destructive actions follow the documented confirmation
contract. Reconciliation, import, and maintenance must not silently repair
source discrepancies.

## 5. Airport reference and curation

Airports use two layers:

1. **OurAirports reference data:** operator-refreshed, searchable reference
   rows with stable source identity, identifiers, location, type,
   scheduled-service status, and active/inactive state. MCP tools never write
   this layer. Refreshes are atomic, retain removed rows as inactive, record
   source version and counts, and log drift for pinned or leg-referenced
   fields rather than silently changing historical meaning.
2. **Travel curation:** keyed by code, with `servesPlace`, notes, and optional
   coordinate pins. Existing owner airport rows are migrated into curation.
   Standalone curation rows support endpoints absent from OurAirports, such as
   NYP.

A transport endpoint is valid if it resolves through either layer or is
already used by a leg. The system must work when the reference layer is empty.
Closed historical airports such as SXF and MJV remain valid when retained by
curation or a historical leg. Airport `servesPlace` identifies the actual
destination Place (for example BNK serves Byron Bay), not necessarily the
airport's municipality. Distance calculations use pinned coordinates where
present and must not drift during refresh.

`travel_airport_update` changes curation only and is the only airport write.
Reference rows are read-only; absent codes may be added as standalone
endpoints when the required curation fields are supplied. Airport create,
merge, delete, and request tools are not part of the current surface.

## 6. Existing-data migration

The migration chain contains an earlier draft that can merge Places by
name/country. Migration `20261016171000_guard_travel_place_identity_transition.sql`
checks for every such candidate and aborts if one exists, then blocks new
matches until the transition migration removes the guard. Therefore the
name-based branch must have no rows when the migration runs; it must not be
used as a matching rule in the final model. The deployed schema uses UUIDs and
allows duplicate-looking Places. Rehearse the chain on a backup and test
database, then preserve the per-owner counts and references as rollout
evidence.

### 6.1 Inventory and baseline

Before DDL, inventory the deployed schema and consumers. Capture per-owner
counts, UUIDs, foreign keys, indexes, triggers, RLS policies, audit entity
types, and references across Places, the current `travel_places` table or
view, Journey stops, Visits, Residence parents/periods, tags, polymorphic
entity references, airport curation, and audit history. Create a checksummed
baseline and durable mapping records for every identity transformation. Abort
if any row or reference has no recorded disposition.

### 6.2 Expand schema and map identities

Add the concrete Travel-place relation and normalized Residence-period table
with owner-safe constraints, indexes, RLS, and audit behavior before removing
old structures. Snapshot old Travel-place rows and UUIDs before replacing a
projection. The old Travel-place UUID becomes the canonical Place UUID, and
the new Travel-place relation uses that same Place UUID as its key. Preserve
UUIDs for all other entities whose identity is unchanged.

### 6.3 Backfill canonical Places and Travel relationships

For each former Travel-place row, create a distinct owner-scoped Place using
the existing UUID and preserve its source facts. The migration guard aborts if
another Place has the same owner-scoped name/country; resolve any such case
with explicit operator mapping before deployment, without deleting either
Place. Existing Place rows and UUIDs remain intact; duplicate-looking rows
stay separate pending explicit reconciliation.

Move travel-only intent and archive state to the Travel-place relation. Keep
location facts and personal annotations on Place or its existing personal
relationships. Keep provider attribution separate from user-authored data.

### 6.4 Migrate Residence periods

Create at most one Residence parent per owner and canonical Place. Preserve an
existing Residence UUID when its identity maps unambiguously. Convert every
legacy grouped period into one `place_residence_periods` row, preserving dates,
ongoing state, precision, note, and null values. Do not infer missing dates or
ongoing state. Where multiple old Residence parents map to the same Place,
retain every period and record all old IDs in the migration map; deduplicate
only provably byte-identical duplicate period rows with explicit evidence.

The archived source provides these exact period inputs: Los Angeles (PLC-047)
has a period starting 2016-01-01, no recorded end, `ongoing = false`, day
precision, note `lived here until Sep 2026 move`; London (PLC-048) has a
2017-01-01 period with no recorded end, `ongoing = false`, month precision,
note `also lived here Jan 2017`, and a second period starting 2026-09-23 with
no end, `ongoing = true`, day precision, note `lives here since Sep 23, 2026`.
Preserve these source values; the migration must not reinterpret missing end
dates as ongoing periods.

Use source-row mappings to attach the former London and Los Angeles `Lived in`
rows to their canonical Places. Do not store `Lived in` status. If a source
Place cannot be matched with evidence, preserve it as a distinct Place and
create a reconciliation item instead of guessing.

### 6.5 Repoint references and preserve history

Keep Journey stops, Visits, and Residence parents referencing canonical Place
IDs. Reclassify Travel-place tag and polymorphic entity links to `app.places`
without changing their UUIDs; preserve tag IDs. Keep unrelated Journey,
transport, stay, airport-curation, and Visit UUIDs unchanged. Do not rewrite
append-only audit snapshots. Keep legacy structures available through the
backfill and validation period.

### 6.6 Verify, cut over, and contract

Use a transaction where practical; for large backfills use restartable batches
with checkpoints and idempotent mapping keys. Before cutover verify:

- every pre-migration row and reference has exactly one documented disposition;
- preserved UUIDs resolve and all migrated references remain within the owner;
- one Travel-place and one Residence parent exist per owner/Place;
- no person has more than one ongoing Residence period;
- per-owner and global counts reconcile, with each expected change explained;
- Place, Travel-place, Journey dossier, Visit, Residence `periods[]`, tag,
  airport, and export reads preserve their pre-migration meaning;
- a repeated backfill creates no extra rows or mapping changes.

Deploy code able to read the expanded schema, backfill and verify, then cut
reads and writes over to the canonical model. Contract old duplicated fields,
JSON period storage, and compatibility views only after every API, MCP,
import, and export consumer has moved and rollback no longer depends on them.
Retain migration maps, checksums, reconciliation results, counts, and rollback
steps as release evidence. Do not combine this schema migration with a live
Travel import or unrelated user-data edits.
