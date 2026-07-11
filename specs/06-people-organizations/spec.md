# Feature Specification: People and Organizations

**Feature Branch**: `06-people-organizations`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent people and organizations as durable identities with explicit uncertainty and changing relationships.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - People with Aliases and Contact Methods (Priority: P1)

As a user, I want to record people with multiple aliases and contact methods so that I can recognize the same person across different contexts without assuming identity proof.

**Why this priority**: People are the core identity entity — aliases and contacts are the primary attributes.

**Independent Test**: A person can be created with multiple aliases and contact methods; searching by alias returns the person.

**Acceptance Scenarios**:

1. **Given** a person record with associated `person_aliases`, **When** searched by alias, **Then** the person is found.
2. **Given** a person with multiple `person_contact_methods`, **When** queried with owner scope, **Then** all contact methods are returned.

### User Story 2 - Organizations with Memberships (Priority: P1)

As a user, I want to record organizations and the people who belong to them with optional validity ranges so that I can track employment, membership, and affiliation history.

**Why this priority**: Organization membership is a core relationship type that drives career and people context.

**Independent Test**: An organization can be created with members; querying an organization returns its members with their membership periods.

**Acceptance Scenarios**:

1. **Given** an organization with `organization_memberships`, **When** queried, **Then** each membership includes the person, role, and optional validity range.
2. **Given** a person with past organization memberships, **When** queried for history, **Then** expired memberships are still returned (not deleted).

### User Story 3 - Social Interactions (Priority: P2)

As a user, I want to record non-message social interactions with people or organizations so that I can track meetings, calls, and other contact.

**Why this priority**: Social interactions supplement the communication domain for events that aren't message-based.

**Independent Test**: A social interaction can be recorded against a person or organization with a timestamp and type.

**Acceptance Scenarios**:

1. **Given** a social interaction is created with a person, **When** queried, **Then** the interaction is returned with timestamp and context.
2. **Given** a social interaction references an organization, **When** the organization's history is queried, **Then** the interaction appears.

### Edge Cases

- How does the system handle an ambiguous match where two people share a name?
- What happens when a person's relationship to another person changes over time?
- How does the system handle the `people.person_type` column that includes `'company'` and `'organization'` values despite a separate `app.organizations` table?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A person MUST NOT be deduplicated solely by name — aliases and contact methods are evidence, not identity proof.
- **FR-002**: `app.person_aliases` and `app.person_contact_methods` MUST be typed records linked to a person.
- **FR-003**: `app.person_relationships` MUST support optional validity ranges.
- **FR-004**: `app.organizations` MUST be a separate table from `app.people`.
- **FR-005**: `app.organization_memberships` MUST link people to organizations with optional validity ranges.
- **FR-006**: `app.social_interactions` MUST record non-message contact with a person or organization.
- **FR-007**: API DTOs MUST hide contact methods unless the route has the right owner/scope context.
- **FR-008**: MCP people context MUST return names, roles, relationship labels, evidence, and confidence without dumping private contact data.
- **FR-009**: Tests MUST cover alias search, relationship direction, organization membership dates, ambiguous matches, and contact redaction.

### Key Entities

- **app.people**: Person records with aliases, contact methods, and relationships.
- **app.person_aliases**: Alternate names for a person — evidence, not identity proof.
- **app.person_contact_methods**: Contact information (email, phone, etc.) — sensitive data.
- **app.person_relationships**: Relationships between people with optional validity ranges.
- **app.organizations**: Organization records separate from people.
- **app.organization_memberships**: Links people to organizations with role and validity.
- **app.social_interactions**: Non-message social contact (meetings, calls) with a person or organization.
- **app.user_social_links**: The authenticated user's own social profile URLs — profile data, not imported person data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: People repositories expose people, aliases, contact methods, relationships, organizations, and memberships.
- **SC-002**: Services treat identity resolution as uncertain unless explicitly reviewed.
- **SC-003**: API DTOs hide contact methods unless the route has the right owner/scope context.
- **SC-004**: MCP people context returns names, roles, relationship labels, evidence, and confidence without dumping private contact data.
- **SC-005**: Tests cover alias search, relationship direction, organization membership dates, ambiguous matches, and contact redaction.

## Assumptions

- Callers should prefer `app.organizations` and treat `people.person_type <> 'person'` rows as a legacy path to be retired — this duplication is known technical debt.
- There is no `app.external_identities` table — if provider identity becomes important, it should be modeled as a product feature, not a generic source-mapping subsystem.
- Social interactions cover non-message contact (see also Plan 11 for communications).
- `app.user_social_links` describes the owner's social profiles — it is not an imported person record.
- Default AI evidence provides names, roles, and relationship context only when within granted scope.
