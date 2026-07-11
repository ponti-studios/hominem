# Plan 11: Communications and social

## Outcome

Represent conversations while preserving the privacy of participants and message bodies. Non-message social contact and person/organization external identities are covered in [06-people-organizations.md](06-people-organizations.md) (`social_interactions`, `user_social_links`), not this plan.

## Implementation boundary

- **Schema:** [schema/11-communications-social.sql](schema/11-communications-social.sql)
- **Repository and service:** provide metadata-first thread and message reads with strict excerpt handling.
- **MCP:** remains disabled until consent, participant boundaries, and safety rules are delivered.

## Canonical entities and relationships

`app.communication_threads` (channel: email/sms/signal/social/other, with a `sensitivity` classification of its own) contain `app.communication_messages`. A message's sender resolves directly to `sender_person_id` — there is no separate participant/roster table; only the sender is structurally identified, not the full set of thread participants. A message body may be stored as a private file reference rather than exposed inline.

## Lifecycle and invariants

Message source identifiers (`external_id`) are unique per thread. `communication_threads.sensitivity` (`private`/`sensitive`/`restricted`) layers a second, thread-specific classification on top of the plan-level "highly sensitive" default.

## Privacy and AI evidence

Communications are highly sensitive and disabled for external AI by default. Future AI access must minimize text and respect participant consent.

## Rejected models

- A generic social feed table for private communications.
- Unbounded message search by an external LLM.
- Assuming a sender identity is a known person.

## Divergence from the original design

There is no `communication_accounts` table, no `communication_participants` roster (only the sender is tracked structurally — recipients/CCs are not enumerated), no `communication_message_files` attachment table, and no `social_posts` table. This is a narrower surface than the original design: a thread's non-sender participants and any message attachments are not currently representable as canonical records.

## Delivery acceptance

- [ ] Communications repositories expose threads, messages, sender identity, timestamps, and source metadata.
- [ ] Services minimize message text access and separate sender identity from resolved people.
- [ ] API DTOs default to metadata and excerpts rather than unrestricted conversation bodies.
- [ ] MCP communications access remains disabled until explicit consent, participant boundaries, and safety rules exist.
- [ ] Tests cover thread search, sender mapping, excerpt limits, and disabled external AI access.
- [ ] Deferred: communication accounts, participant rosters, attachments, and social posts.

## Deferred work

None.
