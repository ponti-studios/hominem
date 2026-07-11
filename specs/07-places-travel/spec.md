# Feature Specification: Places and Travel

**Feature Branch**: `07-places-travel`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Model meaningful places, presence, and travel while preserving location privacy and temporal accuracy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Places with Coordinates and Addresses (Priority: P1)

As a user, I want to record places with optional address and coordinates so that I can reference meaningful locations without exposing exact location data by default.

**Why this priority**: Places are the foundational entity for location-based features.

**Independent Test**: A place can be created with an address, coordinates (both-or-neither), and rating; coordinates are optional.

**Acceptance Scenarios**:

1. **Given** a place with both `latitude` and `longitude`, **When** stored, **Then** both are present — neither is stored alone.
2. **Given** a place without coordinates, **When** stored, **Then** it has an address but null coordinates.

### User Story 2 - Place Visits with Temporal Windows (Priority: P2)

As a user, I want to record when I visited a place so that I can track my presence history.

**Why this priority**: Visits are the core temporal-location feature.

**Independent Test**: A visit can be created at a place with start and end times; end cannot precede start.

**Acceptance Scenarios**:

1. **Given** a place visit with start and end times, **When** queried, **Then** the visit is returned with the temporal window.
2. **Given** a visit where end precedes start, **When** validated, **Then** an error is returned.

### User Story 3 - Trips with Travel Segments (Priority: P2)

As a user, I want to organize travel into trips with segments (flight, rail, road, lodging, other) so that I can track my travel history coherently.

**Why this priority**: Trips and segments are the core travel organization feature.

**Independent Test**: A trip with multiple segments (flights, lodging) can be created; segments are ordered by time and reference origin/destination places.

**Acceptance Scenarios**:

1. **Given** a trip with two segments (flight there, hotel stay), **When** queried, **Then** both segments are returned in temporal order.
2. **Given** a segment with an origin and destination place, **When** queried, **Then** both place references are resolved.

### Edge Cases

- What happens when a visit spans multiple days — is it one visit or multiple?
- How does the system handle a place that exists but has no map-provider identity?
- What happens when exact coordinates are accidentally exposed through a public API response?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.places` MUST store address, optional coordinates (both-or-neither), and rating.
- **FR-002**: `app.place_visits` MUST record time at a place; visit end MUST NOT precede start.
- **FR-003**: `app.travel_trips` MUST contain `app.travel_segments` (flight/rail/road/lodging/other).
- **FR-004**: Segments MUST belong to one trip and MUST have ordered temporal endpoints when known.
- **FR-005**: A place MUST be able to exist without an address or map-provider identity.
- **FR-006**: API DTOs MUST redact exact coordinates and address details unless explicitly needed by the product surface.
- **FR-007**: MCP place context MUST use coarse labels by default and include minimal evidence.
- **FR-008**: Tests MUST cover place search, visit windows, trip membership, reservation/segment ordering, and location redaction.

### Key Entities

- **app.places**: Places with address, optional coordinates (both-or-neither), and rating.
- **app.place_visits**: Time-bounded visits to a place.
- **app.travel_trips**: Travel trips containing segments.
- **app.travel_segments**: Flight/rail/road/lodging/other segments within a trip, optionally referencing origin/destination places.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Places repositories expose places, visits, trips, and travel segments.
- **SC-002**: Services distinguish exact coordinates, labels, addresses, visits, and itinerary facts.
- **SC-003**: API DTOs redact exact coordinates and address details unless explicitly needed by the product surface.
- **SC-004**: MCP place context uses coarse labels by default and includes minimal evidence.
- **SC-005**: Tests cover place search, visit windows, trip membership, segment ordering, and location redaction.

## Assumptions

- `places.provider_payload jsonb` exists as implementation detail and must not be exposed by default.
- Three concepts from the original design are not implemented: `place_aliases`, `place_collections`/`place_collection_items`, and `residences` — these are real capability gaps.
- Exact coordinates and historical visits are highly sensitive. Default AI evidence uses a place label and coarse temporal context, never raw coordinates or home addresses.
- There is currently no durable "home address" or residence-history record — nothing currently marks a place as a residence.
- MCP is not enabled until Plan 00 passes its acceptance criteria.
