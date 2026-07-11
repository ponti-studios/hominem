# Feature Specification: Identity, Ownership, and Privacy

**Feature Branch**: `05-identity-ownership-privacy`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Define who owns personal data, how access is granted, and how sensitive data remains protected across web, mobile, and MCP clients.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticated Ownership Resolution (Priority: P1)

As a domain service, I want every operation to resolve an authenticated actor and their ownership context so that data access is always authorized and never trusts client-supplied ownership.

**Why this priority**: Every domain operation depends on identity resolution — without it, no data can be safely accessed.

**Independent Test**: An authenticated route resolves a Better Auth user before entering domain services; a client-supplied owner ID is ignored in favor of the resolved actor.

**Acceptance Scenarios**:

1. **Given** an authenticated request with a valid Better Auth session, **When** a domain service is called, **Then** the actor identity is resolved from the session, not from request parameters.
2. **Given** a request with a client-supplied `owner_userid`, **When** processed, **Then** the service uses the authenticated actor's identity, not the supplied value.

### User Story 2 - Space-Based Sharing (Priority: P2)

As a user, I want to share access to my records with other users through time-bounded space membership so that collaborators can interact with my data without owning it.

**Why this priority**: Sharing is required for collaboration in the workspace and other domains.

**Independent Test**: A space with multiple members, each with time-bounded membership, allows members to access shared entities while non-members and expired members cannot.

**Acceptance Scenarios**:

1. **Given** a space with active members, **When** a member queries shared entities, **Then** they can access entities scoped to the space.
2. **Given** a space member whose `membership_period` has ended, **When** they attempt to access shared entities, **Then** access is denied — but their history is preserved.

### User Story 3 - Privacy Classification Enforcement (Priority: P1)

As a system, I want data classified as `standard`, `sensitive`, or `highly_sensitive` so that AI access and API exposure respect sensitivity ceilings without leaking private data.

**Why this priority**: Privacy classification is the foundation for all domain security rules.

**Independent Test**: A `highly_sensitive` domain (e.g., finance, health) is disabled for external AI by default; a `standard` domain (e.g., music, video) is accessible within its scope.

**Acceptance Scenarios**:

1. **Given** a domain classified as `highly_sensitive`, **When** an external AI attempts to access it without explicit grant, **Then** access is denied.
2. **Given** the `app.portfolios` domain classified as deliberately public, **When** a public route is accessed, **Then** published data is returned without authentication.

### Edge Cases

- What happens when a space member acts on another member's record — does the audit log correctly record both the actor and the owner?
- How does the system handle a request where the authenticated actor is also the record owner — does ownership bypass space membership checks efficiently?
- What happens when a record is shared through both a space and `note_shares` — which access path takes precedence?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Better Auth's `user` MUST be the authentication identity — no per-domain user identity tables.
- **FR-002**: Root private records MUST have `owner_userid` referencing `user`; child records MUST derive ownership through an owner-scoped parent with an RLS policy following that relationship.
- **FR-003**: Application authorization MUST be the MVP access boundary — client-side authorization is never the sole control.
- **FR-004**: Space membership (`app.space_members.membership_period`) MUST be time-bounded, not deleted.
- **FR-005**: Space-item attachment (`app.space_items.membership_period`) MUST be time-bounded, not deleted.
- **FR-006**: `ops.audit_logs` and `ops.search_logs` MUST be append-only with service-role-only RLS — not owner-scoped — because the actor and the record owner may differ.
- **FR-007**: AI responses MUST NOT disclose a record above the capability's sensitivity ceiling.
- **FR-008**: Privacy classification (`standard`/`sensitive`/`highly_sensitive`) MUST be defined at the plan level.
- **FR-009**: `app.portfolios` MUST be the one deliberately public domain — publication is an explicit owner opt-in per record.

### Key Entities

- **user**: Better Auth authentication identity.
- **app.spaces**: Group entities under one or more members (shared visibility/collaboration boundary, not joint ownership).
- **app.space_members**: Active roster with time-bounded `membership_period`.
- **app.space_invites**: Pending/accepted/revoked/expired invitation flow.
- **app.space_items**: Attaches an owned entity to a space (pinned, ordered, time-bounded).
- **app.space_tags**: Scopes a tag to a space.
- **app.task_assignments**: Assigns a task to a space member.
- **ops.audit_logs**: Append-only audit mechanism — service-role-only RLS.
- **ops.search_logs**: Append-only search log — service-role-only RLS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authenticated routes resolve a Better Auth user before entering domain services.
- **SC-002**: Domain services accept an actor/owner context and never trust client-supplied ownership.
- **SC-003**: Space membership and note-sharing reads are covered by repository tests.
- **SC-004**: Public portfolio reads remain explicit exceptions, not a general public-data pattern.
- **SC-005**: Audit-sensitive operations record actor, owner, domain, and action where the current schema supports it.
- **SC-006**: Production runtime-role isolation, consent grants, self-service deletion requests, and household ownership remain deferred.

## Assumptions

- Household ownership (multiple owners jointly holding one record) is out of scope — a space is a shared visibility/collaboration boundary, not joint ownership.
- A dedicated non-superuser runtime database role, strict migration/runtime credential separation, and request-scoped RLS actor enforcement are production hardening items — not blockers for testing.
- Consent-grant infrastructure for third-party/OAuth clients (`access_grants`), a first-class `person_profiles` table, and self-service data-deletion requests are described in the platform's original design intent but are not yet implemented — this is a real gap, not a naming difference.
