# Plan 09: Media and reading

## Outcome

Represent cultural works and a person's relationship to them across reading, listening, viewing, and play — for domains that don't warrant their own dedicated tables. Music and video are large enough, high-volume domains to warrant their own plans: see [12-music.md](12-music.md) and [13-video.md](13-video.md).

## Implementation boundary

- **Schema:** [schema/09-media-reading.sql](schema/09-media-reading.sql)
- **Repository and service:** own typed works, reading, and general media history rather than generic activity rows.
- **MCP:** after Plan 00, return bounded context and recency evidence, not a complete activity history.

## Canonical entities and relationships

`app.media_works` are abstract creative works (book, article, podcast, film, show, game, other), with `creators` stored as a `jsonb` array rather than normalized creator rows. `app.media_consumptions` capture a user's relationship to a work: status, progress, rating.

## Lifecycle and invariants

Progress is a bare `numeric`, not bounded by a unit/total (no `progress_unit` column). Completion is a consumption `status` value, not a property of a work.

## Privacy and AI evidence

Media history is standard sensitivity unless it reveals sensitive interests. AI evidence includes title, creator, progress/status, and relevant record context.

## Rejected models

- Treating a book edition and its abstract work as identical.
- Inferring a rating from completion.

## Divergence from the original design

The original design normalized creators (`media_creators`/`media_work_creators`) and editions (`media_editions`) as their own tables, plus `media_collections`/`media_sessions`. None of these exist in production: creators are a denormalized `jsonb` array on the work, there is no edition/release concept distinct from the work itself, and there are no collections or per-session consumption tracking (only one `media_consumptions` row per work, updated in place). This is a real simplification, not a naming difference — a work's "edition" (e.g. hardcover vs. audiobook) is not separately representable.

Music and video, meanwhile, went the *opposite* direction from "no separate unrelated tables for every media provider": they became dedicated, richer domains (ch. 16, 17) rather than rows in `media_works`, because their access patterns (track-level listens, per-episode watch time) didn't fit the generic work/consumption shape.

## Delivery acceptance

- [ ] Media repositories expose works and consumption/progress records.
- [ ] Services distinguish work identity, progress, status, and rating.
- [ ] API DTOs avoid implying inferred ratings or ownership.
- [ ] MCP media context returns bounded summaries of reading/watching/listening progress with evidence.
- [ ] Tests cover work lookup, progress updates, rating absence, and sensitive-interest handling.
- [ ] Deferred: creators, editions, collections, sessions, and unifying generic media with music/video.

## Deferred work

None.
