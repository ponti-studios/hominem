# Plan approval gate

An implementation plan is approved only when it has an explicit reviewer decision and no unresolved schema-affecting questions.

| Area | Plan | SQL specification | Approval required |
| --- | --- | --- | --- |
| MCP foundation | 00 | 00 | Product, API, security |
| Career and public portfolio | 01 | 01 | Product, data, privacy (compensation fields are highly sensitive; portfolio publishing is the platform's one public-data exception) |
| Omiro workspace | 02 | 02 | Product, data, AI/privacy |
| Files, sources, and evidence | 03 | 03 | Product, data, privacy |
| Calendar and time | 04 | 04 | Product, data, privacy |
| Identity, ownership, and privacy | 05 | 05 | Product, data, security/privacy |
| People and organizations | 06 | 06 | Product, data, privacy |
| Places and health | 07–08 | 07–08 | Product, data, privacy |
| Media and possessions | 09–10 | 09–10 | Product, data |
| Communications | 11 | 11 | Product, data, security/privacy |
| Music and video | 12–13 | 12–13 | Product, data |
| Finance | 14 | 14 | Product, data, finance/privacy |

Approval produces a tagged design decision. This table is a checklist, not a completed approval record. Any future design change starts with the relevant plan and SQL specification, updated *before* the Goose migration or application code that implements it.

## Known open items outside this approval scope

These are called out in individual plans and repeated here so they aren't missed in review:

- No consent-grant (`access_grants`), profile (`person_profiles`), or self-service deletion-request infrastructure exists ([05](../plans/05-identity-ownership-privacy.md)).
- `app.files` is a product file table, not an ingestion artifact system ([03](../plans/03-files-sources-evidence.md)).
- `finance_transactions.amount` duplicates posting amounts, and provider payloads are inlined on canonical rows in finance and places ([03](../plans/03-files-sources-evidence.md), [14](../plans/14-finance.md)).
- `people.person_type` still allows `'company'`/`'organization'`, duplicating `app.organizations` ([06](../plans/06-people-organizations.md)).
- Health, places, and media are all narrower than the original design intended (no sleep/nutrition/medication tracking, no residences/aliases/collections, no editions/creators) ([07](../plans/07-places-travel.md), [08](../plans/08-health.md), [09](../plans/09-media-reading.md)).
- Compensation fields on `career`/`portfolio` tables rely on application-layer redaction before public-portfolio serving; no schema-level column-visibility control exists ([01](../plans/01-career-portfolio.md)).
