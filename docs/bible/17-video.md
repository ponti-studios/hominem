# Video

## Purpose

Represent video viewing history — channels and individual views across YouTube-style content, movies, shows, and clips — as a dedicated domain, for the same reason as [16-music.md](16-music.md): per-view watch time and episode/season structure don't fit the generic media-work model.

## Canonical entities and relationships

`app.video_channels` are the publisher (a YouTube channel, a studio, etc). `app.video_views` are individual watch events, each with a `content_type` (`video`/`episode`/`movie`/`clip`/`short`), optional season/episode numbers, and both a `duration_seconds` (the content's total length) and `watch_time_seconds` (how much was actually watched).

## Lifecycle and invariants

A view's `completed` flag is independent of `watch_time_seconds` reaching `duration_seconds` — a provider may report "completed" without exact watch-time parity. `channel_name` is denormalized onto `video_views` even when `channel_id` is set, for the same read-performance reason as music's denormalized artist/album names.

## Privacy, provenance, and AI evidence

Video history is standard sensitivity unless it reveals sensitive interests. AI evidence includes title, channel, and watch recency, not full view-by-view history by default.

## Rejected models

- Treating a view as a rating or a purchase.
- Deduplicating channels across providers without an explicit merge decision.

## Implementation readiness

- [ ] Video repositories expose channels and view records.
- [ ] Services distinguish content duration, watched duration, completion, provider, and channel identity.
- [ ] API DTOs avoid treating a view as ownership, purchase, or rating.
- [ ] MCP video context returns bounded summaries and recency evidence, not full view logs by default.
- [ ] Tests cover completion semantics, channel denormalization, content types, watch-time filters, and sensitive-interest handling.
- [ ] Deferred: channel deduplication, ratings, ownership, and richer episode/series modeling.

## Open questions

None. This chapter did not exist in the original design; it was split out of [09-media-reading.md](09-media-reading.md) during reconciliation because production already implements it as a dedicated domain.
