# People and organizations

## Purpose

Represent people and organizations as durable identities with explicit uncertainty and changing relationships.

## Canonical entities and relationships

`app.people` have `app.person_aliases`, `app.person_contact_methods`, and `app.person_relationships`. `app.organizations` have `app.organization_memberships` linking to people. `app.social_interactions` record non-message social contact with a person or organization (see also [11-communications-social.md](11-communications-social.md)). `app.user_social_links` holds the authenticated user's own social profile URLs (github/linkedin/twitter/website) — it describes the owner, not an imported person, and is closer to profile data than to people/organizations matching evidence.

## Lifecycle and invariants

A person is not deduplicated solely by name. Aliases and contact methods are evidence, not identity proof. Relationships and memberships have optional validity ranges. Ambiguous identity matches become `app.import_review_items` (see [02-provenance-files-imports.md](02-provenance-files-imports.md)).

## Privacy, provenance, and AI evidence

Contact methods and relationships are sensitive. AI provides names/roles/relationship context only when within granted scope and includes source/freshness where imported.

## Rejected models

- One polymorphic `contact` blob.
- Automatic merges based on shared names.

## Divergence from the original design

`app.people.person_type` includes `'company'` and `'organization'` values alongside `'person'`, even though a separate `app.organizations` table also exists — this is exactly the "organizations as people with a type flag" pattern the original design rejected. This reconciliation does not resolve the duplication; it flags it as unresolved technical debt for whoever next touches this domain: callers should prefer `app.organizations` and treat `people.person_type <> 'person'` rows as a legacy path to be retired, not a second valid representation.

There is no `app.external_identities` table. External-provider identity mapping for a person or organization is handled generically through `app.entity_source_records` (see ch. 02) rather than a dedicated per-person/organization table with a `provider`/`external_id` pair.

## Implementation readiness

- [ ] People repositories expose people, aliases, contact methods, relationships, organizations, and memberships.
- [ ] Services treat identity resolution as uncertain unless explicitly reviewed.
- [ ] API DTOs hide contact methods unless the route has the right owner/scope context.
- [ ] MCP people context returns names, roles, relationship labels, evidence, and confidence without dumping private contact data.
- [ ] Tests cover alias search, relationship direction, organization membership dates, ambiguous matches, and contact redaction.
- [ ] Deferred: retiring `people.person_type <> 'person'` and adding dedicated external-identity records.

## Open questions

None.
