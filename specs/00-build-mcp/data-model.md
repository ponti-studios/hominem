# Data Model: Build MCP

## Overview

This plan adds four new tables to the `app` schema for entity registry, cross-domain
linking, attributes, and AI usage tracking. These tables are the MCP foundation —
they are not domain-specific. Domain plans (01–14) continue to store their own data
in typed domain tables; this model provides the index and audit layer on top.

## Entity Registry

### `app.entities`

Owner-scoped registry for selected typed domain rows. This is an index, not the
primary domain model — domain facts live in typed domain tables.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique entity identifier |
| `owner_userid` | `text` | FK → `user.id`, NOT NULL | Entity owner |
| `domain` | `text` | NOT NULL | Domain namespace (e.g., `career`, `knowledge`) |
| `domain_id` | `uuid` | NOT NULL | FK to the domain table's primary key |
| `entity_type` | `text` | NOT NULL | Type label within the domain (e.g., `portfolio`, `note`) |
| `space_id` | `uuid` | FK → `app.spaces.id`, nullable | Optional space scoping |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Constraints**:
- Unique on `(domain, domain_id)` — one registry entry per domain row
- RLS: `owner_userid = auth.uid()` OR member of the entity's space

### `app.entity_links`

Records real relationships between entities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique link identifier |
| `source_entity_id` | `uuid` | FK → `app.entities.id`, NOT NULL | Source entity |
| `target_entity_id` | `uuid` | FK → `app.entities.id`, NOT NULL | Target entity |
| `link_type` | `text` | NOT NULL | Relationship type (e.g., `references`, `attaches_to`, `derived_from`) |
| `metadata` | `jsonb` | nullable | Bounded link metadata |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |

**Constraints**:
- RLS inherits from source entity's RLS

### `app.entity_attributes`

Holds sparse, namespaced, evidence-backed derived attributes on entities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique attribute identifier |
| `entity_id` | `uuid` | FK → `app.entities.id`, NOT NULL | Entity this attribute belongs to |
| `namespace` | `text` | NOT NULL | Attribute namespace (e.g., `ai.summary`, `import.source`) |
| `key` | `text` | NOT NULL | Attribute key within namespace |
| `value` | `jsonb` | NOT NULL | Attribute value |
| `evidence` | `jsonb` | nullable | Bounded evidence supporting this attribute |
| `confidence` | `numeric` | CHECK 0–1, nullable | Confidence score (0–1) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Constraints**:
- Unique on `(entity_id, namespace, key)`
- RLS inherits from entity's RLS

## AI Usage Tracking

### `app.ai_usage_events`

Records operational AI usage without storing prompts or private-content evidence.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique event identifier |
| `owner_userid` | `text` | FK → `user.id`, NOT NULL | User whose AI interaction this tracks |
| `provider` | `text` | NOT NULL | AI provider (e.g., `openrouter`, `openai`) |
| `feature` | `text` | NOT NULL | Feature identifier (e.g., `mcp.career`, `mcp.knowledge`) |
| `model` | `text` | NOT NULL | Model identifier (e.g., `gpt-4o`, `claude-3-opus`) |
| `prompt_tokens` | `integer` | NOT NULL | Token count for the prompt |
| `completion_tokens` | `integer` | NOT NULL | Token count for the completion |
| `cost_usd` | `numeric(10,6)` | NOT NULL | Computed cost in USD |
| `duration_ms` | `integer` | nullable | Request duration in milliseconds |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Event timestamp |

**Constraints**:
- Does NOT store prompts, responses, or private-content evidence
- RLS: `owner_userid = auth.uid()` OR `auth.is_service_role()`

## Relationships

```
app.entities 1───* app.entity_links (source)
app.entities 1───* app.entity_links (target)
app.entities 1───* app.entity_attributes
app.entities *───1 app.spaces (optional, via space_id)
```

## RLS Policy Summary

| Table | Owner Select | Space Member Select | Service Role |
|-------|-------------|-------------------|--------------|
| `app.entities` | Yes | Yes (if entity is in space) | Full access |
| `app.entity_links` | Via source entity | Via source entity | Full access |
| `app.entity_attributes` | Via entity | Via entity | Full access |
| `app.ai_usage_events` | Yes (own events) | No | Full access |
