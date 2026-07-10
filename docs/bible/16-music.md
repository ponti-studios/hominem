# Music

## Purpose

Represent music listening history — artists, albums, tracks, playlists, and individual listens — as a dedicated domain rather than rows in the generic media-work model, because per-track listen events and playlist ordering don't fit that shape.

## Canonical entities and relationships

`app.music_artists` have `app.music_albums`; albums have `app.music_tracks`. `app.music_playlists` order tracks via `app.music_playlist_tracks` (`position`). `app.music_listens` record individual listen events, each optionally attributable to a track, with a `context_type`/`context_id` (e.g. "this listen happened during playlist X").

## Lifecycle and invariants

Every artist/album/track/playlist row carries a `source` (the importing provider, e.g. Spotify) and an `external_id`; identity is provider-scoped, not globally deduplicated across providers. A listen's `duration_seconds` and `completed` flag are independent — a listen can be recorded as incomplete without knowing the eventual duration. Track/album art and metadata are denormalized onto each row (`artist_name`, `album_name`, `album_art_url` are copied onto `music_tracks`, not solely derived by join) for read performance.

## Privacy, provenance, and AI evidence

Music history is standard sensitivity unless it reveals sensitive interests (e.g. political or religious content). AI evidence includes track/artist/album title and listen recency, not full listen-by-listen history by default.

## Rejected models

- Treating a listen as identical to owning or rating the track (there is no rating/ownership concept in this domain — see [10-purchases-possessions.md](10-purchases-possessions.md) if a track is physically owned).
- Deduplicating artists/albums/tracks across providers without an explicit merge decision.

## Implementation readiness

- [ ] Music repositories expose artists, albums, tracks, playlists, playlist tracks, and listens.
- [ ] Services preserve provider-scoped identity and denormalized read fields.
- [ ] API DTOs distinguish catalog metadata from individual listening history.
- [ ] MCP music context returns bounded summaries and recency evidence, not full listen logs by default.
- [ ] Tests cover provider identity, playlist ordering, listen completion/duration, denormalized fields, and sensitive-interest handling.
- [ ] Deferred: cross-provider deduplication, ratings, ownership, and music-specific recommendations.

## Open questions

None. This chapter did not exist in the original design; it was split out of [09-media-reading.md](09-media-reading.md) during reconciliation because production already implements it as a dedicated domain.
