# Identity, ownership, and privacy

## Purpose

Define who owns personal data, how access is granted, and how sensitive data remains protected across web, mobile, and MCP clients.

## Canonical entities and relationships

Better Auth's `user` is the authentication identity. Root private records have `owner_userid` referencing `user`; child records derive ownership through an owner-scoped parent and require an RLS policy that follows that parent relationship. Ownership can be **shared**: `app.spaces` group entities under one or more members. `app.space_members` is the active roster (time-bounded via `membership_period`); `app.space_invites` is the pending/accepted/revoked/expired invitation flow into a space; `app.space_items` attaches an entity its actor owns to a space (pinned, ordered, time-bounded membership); `app.space_tags` scopes a tag to a space. `app.task_assignments` assigns a task to a space member.

## Lifecycle and invariants

Records are active, archived, or soft-deleted where history matters. Space membership and space-item attachment are both **time-bounded, not deleted** — `space_members.membership_period` and `space_items.membership_period` record when access started and ended, so a removed member's history isn't lost. Application authorization is the MVP access boundary. A dedicated non-superuser runtime database role, strict migration/runtime credential separation, and request-scoped RLS actor enforcement are production hardening items, not blockers for testing the product concept.

## Privacy classification

`standard`, `sensitive`, and `highly_sensitive` classify data at the chapter level (see each domain chapter). Finance, health, private communications, exact location, raw artifacts, and career compensation data are never enabled for external AI access by default. `app.portfolios` is the one deliberately **public** domain — see [18-career-portfolio.md](18-career-portfolio.md) — and sits outside this classification; publication is an explicit owner opt-in per record, not a default.

## Provenance and AI evidence

`ops.audit_logs` and `ops.search_logs` are the audit mechanism: append-only, service-role-only RLS (`auth.is_service_role()`), not owner-scoped like domain tables, because the actor recording an audit event and the record's owner are not always the same principal (e.g. a space member acting on another owner's record). AI responses must not disclose a record above the capability's sensitivity ceiling.

## Rejected models

- Client-side authorization as the sole control.
- Per-domain user identity tables.
- Household ownership — multiple owners jointly holding one record — remains out of scope; a space is a shared visibility/collaboration boundary around one owner's records, not joint ownership.

## Implementation readiness

- [ ] Authenticated routes resolve a Better Auth user before entering domain services.
- [ ] Domain services accept an actor/owner context and never trust client-supplied ownership.
- [ ] Space membership and note-sharing reads are covered by repository tests.
- [ ] Public portfolio reads remain explicit exceptions, not a general public-data pattern.
- [ ] Audit-sensitive operations record actor, owner, domain, and action where the current schema supports it.
- [ ] Deferred: production runtime-role isolation, consent grants, self-service deletion requests, and household ownership.

## Open questions

None. Consent-grant infrastructure for third-party/OAuth clients (`access_grants`), a first-class `person_profiles` table, and self-service data-deletion requests are described in the platform's original design intent but are **not yet implemented** in production — this is a real gap, not a naming difference, and should be treated as unbuilt scope rather than assumed to exist under another name.
