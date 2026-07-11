# Feature Specification: Music

**Feature Branch**: `12-music`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent music listening history — artists, albums, tracks, playlists, and individual listens — as a dedicated domain rather than rows in the generic media-work model.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Artists, Albums, and Tracks (Priority: P1)

As a user, I want to record music artists with their albums and tracks so that I can maintain a provider-scoped catalog of music.

**Why this priority**: The artist→album→track hierarchy is the foundational music catalog structure.

**Independent Test**: An artist with one album containing multiple tracks can be created; querying the artist returns albums, and albums return tracks.

**Acceptance Scenarios**:

1. **Given** an artist with an album containing three tracks, **When** queried, **Then** the artist, album, and all three tracks are returned.
2. **Given** a track carries denormalized `artist_name`, `album_name`, and `album_art_url`, **When** queried directly, **Then** those fields are populated without requiring joins.

### User Story 2 - Playlists with Ordered Tracks (Priority: P1)

As a user, I want to create playlists that order tracks by position so that I can organize music into sequences.

**Why this priority**: Playlists are a core organizational feature distinct from artist/album structure.

**Independent Test**: A playlist with three tracks in a specific order can be created; querying returns tracks in that order.

**Acceptance Scenarios**:

1. **Given** a playlist with three tracks at positions 1, 2, 3, **When** queried, **Then** tracks are returned in position order.
2. **Given** a track is added to a playlist at position 4, **When** the playlist is queried, **Then** the new track appears at position 4.

### User Story 3 - Individual Listen Events (Priority: P2)

As a user, I want to record individual listen events, each optionally attributable to a track and context (playlist, album), so that I can track listening history over time.

**Why this priority**: Listen events are what differentiate music from a static catalog — they enable history and recency queries.

**Independent Test**: A listen event for a track within a playlist context can be recorded; querying recent listens returns them in reverse chronological order.

**Acceptance Scenarios**:

1. **Given** a listen event for a track with `context_type: playlist` and `context_id`, **When** queried, **Then** the listen records the track, timestamp, and playlist context.
2. **Given** multiple listen events over several days, **When** queried for recent listens, **Then** they are returned sorted by timestamp descending.

### User Story 4 - MCP Music Context (Priority: P2)

As an AI assistant, I want to query bounded music listening context (recent listens, top artists) so that I can answer music-related questions without full listen logs.

**Why this priority**: MCP music context enables AI-assisted queries about listening habits.

**Independent Test**: An MCP query returns bounded summaries (recent tracks, top artists) — not full listen-by-listen history.

**Acceptance Scenarios**:

1. **Given** an MCP tool queries music context, **When** recent listens are requested, **Then** bounded summaries (track/artist/album title, listen recency) are returned.
2. **Given** a track with no listens, **When** queried, **Then** no-data is returned rather than implying the track exists in listening history.

### Edge Cases

- What happens when a listen's `duration_seconds` is null but `completed` is true?
- How does the system handle an artist that exists on multiple streaming providers — are they separate records or merged?
- What happens when a track's album art URL changes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.music_artists` MUST contain `app.music_albums`; albums MUST contain `app.music_tracks`.
- **FR-002**: Every artist/album/track/playlist MUST carry `source` and `external_id` — identity is provider-scoped, not globally deduplicated.
- **FR-003**: Track/album art and metadata MUST be denormalized onto each row (`artist_name`, `album_name`, `album_art_url` on `music_tracks`) for read performance.
- **FR-004**: `app.music_playlists` MUST order tracks via `app.music_playlist_tracks` with a `position` field.
- **FR-005**: `app.music_listens` MUST record individual listen events, optionally attributable to a track with `context_type`/`context_id`.
- **FR-006**: A listen's `duration_seconds` and `completed` flag MUST be independent.
- **FR-007**: API DTOs MUST distinguish catalog metadata from individual listening history.
- **FR-008**: MCP music context MUST return bounded summaries and recency evidence, not full listen logs by default.
- **FR-009**: Tests MUST cover provider identity, playlist ordering, listen completion/duration, denormalized fields, and sensitive-interest handling.

### Key Entities

- **app.music_artists**: Music artists, provider-scoped by `source`/`external_id`.
- **app.music_albums**: Albums belonging to an artist.
- **app.music_tracks**: Tracks within an album with denormalized artist/album names and art URL.
- **app.music_playlists**: User-created playlists.
- **app.music_playlist_tracks**: Junction table ordering tracks in a playlist via `position`.
- **app.music_listens**: Individual listen events with optional track attribution and context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Music repositories expose artists, albums, tracks, playlists, playlist tracks, and listens.
- **SC-002**: Services preserve provider-scoped identity and denormalized read fields.
- **SC-003**: API DTOs distinguish catalog metadata from individual listening history.
- **SC-004**: MCP music context returns bounded summaries and recency evidence, not full listen logs by default.
- **SC-005**: Tests cover provider identity, playlist ordering, listen completion/duration, denormalized fields, and sensitive-interest handling.

## Assumptions

- Music history is standard sensitivity unless it reveals sensitive interests (political, religious).
- Artists/albums/tracks are not deduplicated across providers without an explicit merge decision.
- There is no rating or ownership concept in this domain — see Plan 10 if a track is physically owned.
- A listen can be recorded as incomplete without knowing the eventual duration.
- Cross-provider deduplication, ratings, ownership, and music-specific recommendations are deferred.
