# Plan 07: Places and travel

## Outcome

Model meaningful places, presence, and travel while preserving location privacy and temporal accuracy.

## Implementation boundary

- **Schema:** [schema/07-places-travel.sql](schema/07-places-travel.sql)
- **Repository and service:** apply typed place and travel reads, including location precision and provider-payload redaction.
- **MCP:** after Plan 00, expose only scoped, bounded place context; exact location stays disabled by default.

## Canonical entities and relationships

`app.places` have an address, coordinates, and a rating. `app.place_visits` record time at a place. `app.travel_trips` contain `app.travel_segments` (flight/rail/road/lodging/other), each optionally referencing an origin/destination place.

## Lifecycle and invariants

Coordinates are optional and precision-aware (`latitude`/`longitude` are both-or-neither). A visit end cannot precede its start. Segments belong to one trip and have ordered temporal endpoints when known. A place can exist without an address or map-provider identity.

## Privacy and AI evidence

Exact coordinates and historical visits are highly sensitive. Default AI evidence uses a place label and coarse temporal context, never raw coordinates or home addresses.

## Rejected models

- Storing all locations as strings on unrelated tables.
- Inferring residence from visit frequency.
- Treating travel reservations as calendar events.

## Divergence from the original design

Three concepts from the original design are **not implemented**: `place_aliases` (alternate names for a place), `place_collections`/`place_collection_items` (grouping places), and `residences` (a time-bounded place relationship marking where the owner lived). There is currently no durable "home address" or residence-history record distinct from an ordinary place visit — this is a real capability gap, not a rename, and is relevant to the privacy plan's promise to never expose "home addresses" as a category, since nothing currently marks a place as a residence. `places.provider_payload jsonb` exists as implementation detail and must not be exposed by default.

## Delivery acceptance

- [ ] Places repositories expose places, visits, trips, reservations, and travel segments.
- [ ] Services distinguish exact coordinates, labels, addresses, visits, and itinerary facts.
- [ ] API DTOs redact exact coordinates and address details unless explicitly needed by the product surface.
- [ ] MCP place context uses coarse labels by default and includes minimal evidence.
- [ ] Tests cover place search, visit windows, trip membership, reservation/segment ordering, and location redaction.
- [ ] Deferred: residences, place aliases, collections, and formal home-address classification.

## Deferred work

None.
