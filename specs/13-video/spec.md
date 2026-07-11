# Feature Specification: Video

**Feature Branch**: `13-video`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent video viewing history — channels and individual views across YouTube-style content, movies, shows, and clips — as a dedicated domain.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Video Views with Content Types (Priority: P1)

As a user, I want to record individual view events with content type (video/episode/movie/clip/short), optional season/episode numbers, and both content duration and watch time so that I can track what I've watched and how much I watched.

**Why this priority**: View events are the core video entity — content type, duration, and watch time capture the essential viewing data.

**Independent Test**: A view event for a video with content type, duration, watch time, and completion status can be recorded and retrieved.

**Acceptance Scenarios**:

1. **Given** a view event for a movie with `content_type: movie`, `duration_seconds: 7200`, and `watch_time_seconds: 6800`, **When** queried, **Then** all fields including `completed: true` are returned.
2. **Given** a view event for an episode with `season_number: 2` and `episode_number: 5`, **When** queried, **Then** the season/episode context is returned.

### User Story 2 - Channels as Publishers (Priority: P1)

As a user, I want to record video channels as the publishing entity (YouTube channel, studio, etc.) so that views can be attributed to a publisher.

**Why this priority**: Channels group views by publisher — essential for analytics and browsing.

**Independent Test**: A channel can be created and views attributed to it; querying the channel returns its views.

**Acceptance Scenarios**:

1. **Given** a video channel (e.g., "YouTube Channel X"), **When** multiple view events are attributed to it via `channel_id`, **Then** querying the channel returns those views.
2. **Given** a view without a channel reference, **When** stored, **Then** `channel_id` is null but the view is still valid.

### User Story 3 - MCP Video Context (Priority: P2)

As an AI assistant, I want to query bounded video viewing context (recent views, top channels) so that I can answer questions about viewing habits without full view logs.

**Why this priority**: MCP video context enables AI-assisted queries about viewing history.

**Independent Test**: An MCP query returns bounded summaries (recent views, top channels) — not full view-by-view history.

**Acceptance Scenarios**:

1. **Given** an MCP tool queries video context, **When** recent views are requested, **Then** bounded summaries (title, channel, watch recency) are returned.
2. **Given** a view with `content_type: short`, **When** summarized, **Then** it is included with the same bounded evidence format.

### Edge Cases

- What happens when `watch_time_seconds` exceeds `duration_seconds`?
- How does the system handle a view where `completed: true` but `watch_time_seconds` is significantly less than `duration_seconds`?
- What happens when a channel name changes — does the denormalized `channel_name` on existing views become stale?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.video_views` MUST record individual watch events with `content_type` (video/episode/movie/clip/short).
- **FR-002**: Each view MUST carry both `duration_seconds` (content's total length) and `watch_time_seconds` (how much was watched).
- **FR-003**: The `completed` flag MUST be independent of `watch_time_seconds` reaching `duration_seconds`.
- **FR-004**: Views MUST support optional `season_number` and `episode_number` for episodic content.
- **FR-005**: `app.video_channels` MUST be the publishing entity (YouTube channel, studio, etc.).
- **FR-006**: `channel_name` MUST be denormalized onto `video_views` even when `channel_id` is set.
- **FR-007**: API DTOs MUST NOT treat a view as ownership, purchase, or rating.
- **FR-008**: MCP video context MUST return bounded summaries and recency evidence, not full view logs by default.
- **FR-009**: Tests MUST cover completion semantics, channel denormalization, content types, watch-time filters, and sensitive-interest handling.

### Key Entities

- **app.video_channels**: Publishing entities (YouTube channels, studios, etc.).
- **app.video_views**: Individual watch events with content type, duration, watch time, completion, and optional season/episode numbers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Video repositories expose channels and view records.
- **SC-002**: Services distinguish content duration, watched duration, completion, provider, and channel identity.
- **SC-003**: API DTOs avoid treating a view as ownership, purchase, or rating.
- **SC-004**: MCP video context returns bounded summaries and recency evidence, not full view logs by default.
- **SC-005**: Tests cover completion semantics, channel denormalization, content types, watch-time filters, and sensitive-interest handling.

## Assumptions

- Video history is standard sensitivity unless it reveals sensitive interests.
- Channels are not deduplicated across providers without an explicit merge decision.
- A view is not a rating or a purchase — there is no ownership or rating concept in this domain.
- Channel deduplication, ratings, ownership, and richer episode/series modeling are deferred.
- This plan is split out of Plan 09 because video behaves like a dedicated product domain.
