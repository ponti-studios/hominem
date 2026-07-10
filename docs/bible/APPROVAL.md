# Bible approval gate

The Bible is approved only when every chapter has an explicit reviewer decision and there are no schema-affecting open questions.

| Area | Bible chapter | SQL specification | Approval required |
| --- | --- | --- | --- |
| Foundation | 00–02 | 00–02 | Product, data, security |
| Time and finance | 03–04 | 03–04 | Product, data, finance/privacy |
| Knowledge and identity | 05–06 | 05–06 | Product, data, AI/privacy |
| Places and health | 07–08 | 07–08 | Product, data, privacy |
| Media and possessions | 09–10 | 09–10 | Product, data |
| Communications | 11 | 11 | Product, data, security/privacy |
| Client and MCP policy | 12–15 | 12 (ai_usage_events only; 13–15 remain n/a) | Product, API, security |
| Music | 16 | 16 | Product, data |
| Video | 17 | 17 | Product, data |
| Career and public portfolio | 18 | 18 | Product, data, privacy (compensation fields are highly sensitive; portfolio publishing is the platform's one public-data exception) |

Approval produces a tagged baseline-design decision. For chapters `00`–`18` as reconciled here, that decision is a statement that the chapter accurately describes the live schema — no reviewer has yet signed off on this reconciliation pass; **this table is a checklist, not a completed approval record**. Any future design change (not just documentation of existing state) starts with the relevant Bible chapter and SQL specification, updated *before* the Goose migration that implements it.

## Known open items outside this reconciliation's scope

These are called out in individual chapters and repeated here so they aren't missed in review:

- No consent-grant (`access_grants`), profile (`person_profiles`), or self-service deletion-request infrastructure exists ([01](01-identity-ownership-privacy.md)).
- `app.files` is not content-addressed, unlike the import-artifact model it sits beside ([02](02-provenance-files-imports.md)).
- `finance_transactions.amount` duplicates posting amounts, and provider payloads are inlined on canonical rows in finance and places ([02](02-provenance-files-imports.md), [04](04-finance.md)).
- `people.person_type` still allows `'company'`/`'organization'`, duplicating `app.organizations` ([06](06-people-organizations.md)).
- Health, places, and media are all narrower than the original design intended (no sleep/nutrition/medication tracking, no residences/aliases/collections, no editions/creators) ([07](07-places-travel.md), [08](08-health.md), [09](09-media-reading.md)).
- Compensation fields on `career`/`portfolio` tables rely on application-layer redaction before public-portfolio serving; no schema-level column-visibility control exists ([18](18-career-portfolio.md)).
