# Plan 02: Omiro workspace

## Outcome

Build the notes, chats, tasks, and AI-assisted workspace already used by
`apps/omiro`, while keeping authored content and AI-derived material distinct.
The MCP vertical reads these production records through the same service
boundary; it does not introduce a separate knowledge store.

## Implementation boundary

- **Schema:** [schema/02-omiro-workspace.sql](schema/02-omiro-workspace.sql)
- **Repository and service:** preserve authored/derived separation and apply note, chat, task, and sharing read rules.
- **MCP:** after Plan 00, offer scoped retrieval with evidence and confidence, never an unrestricted content dump.

## Canonical entities and relationships

`app.notes` is a versioned document: the note row holds a pointer (`current_version_id`) into `app.note_versions`, and each version carries its own `status` (`draft`/`published`/`archived`), `note_type` (`note`/`document`/`template`), and optional `published_at`/`scheduled_for` — the model doubles as lightweight CMS/publishing, not just private notes. `app.chats` hold `app.chat_messages`; a chat may be anchored to a note (`chats.note_id`) as an AI notebook thread. `app.tasks` are separate, may nest (`parent_task_id`), and can be shared/assigned within a space (`primary_space_id`, `app.task_assignments`). `app.extracted_facts` cite a subject entity, a predicate/value, a plain source label, bounded evidence JSON, and confidence; there is no import-record provenance layer in the MVP. `app.vector_documents` hold embeddings for notes and chats only (not an arbitrary entity). `app.bookmarks` are user-saved links, optionally tied to a place. `app.note_files`/`app.note_shares` attach files and per-note sharing grants to a note; there is no separate `app.documents` table — documents are a `note_versions.note_type` value, not a distinct entity.

## Lifecycle and invariants

Authored content is versioned (`note_versions`). A derived embedding or fact is replaceable and never becomes authored truth. Tasks have explicit status and priority and may nest or be assigned to a space member. `app.files` (see [03-files-sources-evidence.md](03-files-sources-evidence.md)) is not content-addressed.

## Privacy and AI evidence

Private note/chat content is sensitive. AI results cite note/document/message identity, excerpt policy, source timestamp, and confidence; the minimum required content is retrieved.

## Rejected models

- Storing all content as untyped chat messages.
- AI summaries overwriting original notes.
- Embeddings as the only retrievable representation.

## Divergence from the original design

There is no distinct `app.documents` entity — the original design's book-keeping split between "notes" and "documents" collapsed into `note_versions.note_type`. `note_shares` (per-note, per-user, permissioned sharing with `read`/`write` and an expiry) is a second, note-scoped sharing mechanism alongside the space-level sharing in [05-identity-ownership-privacy.md](05-identity-ownership-privacy.md) — the two overlap in purpose and aren't reconciled with each other at the schema level today. Both are RLS-enforced, not just application-checked: `notes`/`note_versions` carry a `SELECT` policy widened by `auth.can_read_note(id)`, and writes to a shared note are gated by `auth.can_write_note(id)` — both functions resolve through `note_shares.access_period` and `permission`.

Tags have the same two-tier pattern: `app.tags`/`tag_aliases`/`tag_assignments` widen `SELECT` via `auth.can_read_tag(tag_id)` (true for the tag owner or any member of a space the tag is shared into via `app.space_tags`), while writes require `auth.is_tag_owner(tag_id)`.

## Delivery acceptance

- [ ] Knowledge repositories expose notes, note versions, chats, messages, tags, links, embeddings, and extracted facts through typed methods.
- [ ] Services distinguish user-authored content, externally sourced content labels, and AI-derived facts without relying on import infrastructure.
- [ ] API DTOs apply excerpt policies and never return unrestricted note/chat dumps by default.
- [ ] MCP knowledge tools support scoped retrieval with evidence, confidence, and no-data responses.
- [ ] Tests cover note sharing, tag sharing, version selection, embedding lookup, fact confidence, and excerpt redaction.
- [ ] Deferred: reconciling note-scoped sharing with space sharing and splitting first-class documents from notes.

## Deferred work

None.
