# Plan 13: Video

## Outcome

Represent video viewing history — channels and individual views across YouTube-style content, movies, shows, and clips — as a dedicated domain, for the same reason as [12-music.md](12-music.md): per-view watch time and episode/season structure don't fit the generic media-work model.

## Implementation boundary

- **Schema:** [schema/13-video.sql](schema/13-video.sql)
- **Repository and service:** distinguish catalog duration, watched duration, completion, provider, and channel identity.
- **MCP:** after Plan 00, return bounded viewing context and recency evidence, not view logs.

## Canonical entities and relationships

`app.video_channels` are the publisher (a YouTube channel, a studio, etc). `app.video_views` are individual watch events, each with a `content_type` (`video`/`episode`/`movie`/`clip`/`short`), optional season/episode numbers, and both a `duration_seconds` (the content's total length) and `watch_time_seconds` (how much was actually watched).

## Lifecycle and invariants

A view's `completed` flag is independent of `watch_time_seconds` reaching `duration_seconds` — a provider may report "completed" without exact watch-time parity. `channel_name` is denormalized onto `video_views` even when `channel_id` is set, for the same read-performance reason as music's denormalized artist/album names.

## Privacy and AI evidence

Video history is standard sensitivity unless it reveals sensitive interests. AI evidence includes title, channel, and watch recency, not full view-by-view history by default.

## Rejected models

- Treating a view as a rating or a purchase.
- Deduplicating channels across providers without an explicit merge decision.

## Delivery acceptance

- [ ] Video repositories expose channels and view records.
- [ ] Services distinguish content duration, watched duration, completion, provider, and channel identity.
- [ ] API DTOs avoid treating a view as ownership, purchase, or rating.
- [ ] MCP video context returns bounded summaries and recency evidence, not full view logs by default.
- [ ] Tests cover completion semantics, channel denormalization, content types, watch-time filters, and sensitive-interest handling.
- [ ] Deferred: channel deduplication, ratings, ownership, and richer episode/series modeling.

## Deferred work

None. This plan is split out of [09-media-reading.md](09-media-reading.md) because video behaves like a dedicated product domain.
