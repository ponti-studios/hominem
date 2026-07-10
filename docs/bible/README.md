# Hominem Bible

This directory is the normative product model for Hominem. A schema change starts by changing the relevant Bible chapter, then its SQL specification in `docs/bible/schema/`, then a Goose migration.

## Reconciled baseline (this pass)

As of this reconciliation, every chapter and SQL specification in `00`–`18` describes the **live, already-materialized `app`/`ops` schema** (verified against a `pg_dump` of the running database), not an unapproved greenfield redesign. Where production diverges structurally from what a chapter would otherwise prescribe — a missing table, a duplicated concept, an inlined field the platform principles reject — the chapter says so explicitly in a "Divergence from the original design" section rather than silently smoothing it over. Two categories of divergence appear throughout:

- **Renames and simplifications** (e.g. `financial_transactions` → `finance_transactions`, `event_series` → `events`): cosmetic or structural differences with no open risk, described directly in the relevant chapter and SQL specification.
- **Unbuilt scope** (e.g. `access_grants`, `sleep_sessions`, `place_aliases`): concepts the original design wanted but production does not implement. These are flagged as real gaps, not assumed to exist under another name.

Three chapters (`16` music, `17` video, `18` career/portfolio) did not exist before this pass — they were split out or added because production already implements them as dedicated domains the original 16-chapter Bible never described.

The documents define durable meaning; they do not preserve Warehouse table layout or application implementation details. `00` through `18` are read in order. An open question is allowed only when it cannot change the canonical schema; schema-affecting uncertainty is resolved before implementation.

## Review rule

Every chapter and SQL specification must be approved together. Application, API, MCP, importer, and client code may only depend on approved, materialized schema. Because this reconciliation pass describes what is *already* running, "approval" here means sign-off that the description is accurate — not permission to build something new. Any *future* design change (adding a table, changing a constraint) still starts with the relevant Bible chapter and SQL specification, updated *before* the migration that implements it.

## Implementation rule

Every chapter includes an implementation readiness checklist. A vertical is ready to build only when its Bible chapter, SQL specification, acceptance checklist, service boundary, RPC/MCP exposure, and test requirements agree. The vertical build order lives in [IMPLEMENTATION.md](IMPLEMENTATION.md).
