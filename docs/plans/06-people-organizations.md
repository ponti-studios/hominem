# Plan 06: People and organizations

## Outcome

Represent people and organizations as durable identities with explicit uncertainty and changing relationships.

## Implementation boundary

- **Schema:** [schema/06-people-organizations.sql](schema/06-people-organizations.sql)
- **Repository and service:** resolve people, organizations, aliases, contact methods, relationships, and social interactions as typed records.
- **MCP:** after Plan 00, expose only scoped people/place context with minimal identity evidence.

## Canonical entities and relationships

`app.people` have `app.person_aliases`, `app.person_contact_methods`, and `app.person_relationships`. `app.organizations` have `app.organization_memberships` linking to people. `app.social_interactions` record non-message social contact with a person or organization (see also [11-communications-social.md](11-communications-social.md)). `app.user_social_links` holds the authenticated user's own social profile URLs (github/linkedin/twitter/website) — it describes the owner, not an imported person, and is closer to profile data than to people/organizations matching evidence.

## Lifecycle and invariants

A person is not deduplicated solely by name. Aliases and contact methods are evidence, not identity proof. Relationships and memberships have optional validity ranges. Ambiguous identity matches are left unresolved for the user or application workflow instead of guessed automatically.

## Privacy and AI evidence

Contact methods and relationships are sensitive. AI provides names/roles/relationship context only when within granted scope.

## Rejected models

- One polymorphic `contact` blob.
- Automatic merges based on shared names.

## Divergence from the original design

`app.people.person_type` includes `'company'` and `'organization'` values alongside `'person'`, even though a separate `app.organizations` table also exists — this is exactly the "organizations as people with a type flag" pattern the product model rejects. This plan does not resolve the duplication; it flags it as unresolved technical debt for whoever next touches this domain: callers should prefer `app.organizations` and treat `people.person_type <> 'person'` rows as a legacy path to be retired, not a second valid representation.

There is no `app.external_identities` table. If provider identity becomes important, it should be modeled as a product feature for people/organizations, not through a generic source-mapping subsystem.

## Delivery acceptance

- [ ] People repositories expose people, aliases, contact methods, relationships, organizations, and memberships.
- [ ] Services treat identity resolution as uncertain unless explicitly reviewed.
- [ ] API DTOs hide contact methods unless the route has the right owner/scope context.
- [ ] MCP people context returns names, roles, relationship labels, evidence, and confidence without dumping private contact data.
- [ ] Tests cover alias search, relationship direction, organization membership dates, ambiguous matches, and contact redaction.
- [ ] Deferred: retiring `people.person_type <> 'person'` and adding dedicated external-identity records.

## Deferred work

None.
