# Data Model: Build MCP

## Overview

This plan documents three tables in the `app` schema that support the MCP layer:
an entity registry for cross-domain references, an entity links table for recording
relationships, and an AI usage tracking table. These tables already exist in
production — no new schema objects are required for Plan 00.

## Entity Registry

### `app.entities`

Owner-scoped registry for selected typed domain rows, auto-synced via database
triggers on 18 domain tables. This is an index, not the primary domain model —
domain facts live in typed domain tables.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `entity_table` | `regclass` | PK, NOT NULL | Domain table OID |
| `entity_id` | `uuid` | PK, NOT NULL | Domain table row ID |
| `owner_userId` | `text` | FK → `user.id`, nullable | Entity owner |
| `space_id` | `uuid` | FK → `app.spaces.id`, nullable, ON DELETE SET NULL | Optional space scoping |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updatedAt` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Constraints**:
- PK: `(entity_table, entity_id)`
- Auto-sync via `app.sync_entity_registry()` trigger function on 18 domain tables
- RLS: `owner_userId = auth.current_user_id()` OR space member

### `app.entity_links`

Records real relationships between entities with temporal validity.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `uuidv7()` | Unique link identifier |
| `owner_userId` | `text` | FK → `user.id`, NOT NULL | Link owner |
| `space_id` | `uuid` | FK → `app.spaces.id`, nullable, ON DELETE SET NULL | Optional space scoping |
| `from_entity_table` | `regclass` | NOT NULL | Source entity table |
| `from_entity_id` | `uuid` | NOT NULL | Source entity row ID |
| `relation_type` | `text` | NOT NULL | Relationship type (e.g., `references`, `attaches_to`, `derived_from`) |
| `to_entity_table` | `regclass` | NOT NULL | Target entity table |
| `to_entity_id` | `uuid` | NOT NULL | Target entity row ID |
| `valid_during` | `tstzrange` | NOT NULL, default `[now(), infinity)` | Temporal validity window |
| `metadata` | `jsonb` | NOT NULL, default `{}` | Bounded link metadata |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updatedAt` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Constraints**:
- FK: `(from_entity_table, from_entity_id)` → `app.entities`
- FK: `(to_entity_table, to_entity_id)` → `app.entities`
- Self-link guard: source and target cannot be the same row
- Non-empty `valid_during` window
- RLS: owner or space member

## AI Usage Tracking

### `app.ai_usage_events`

Records operational AI usage without storing prompts or private-content evidence.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique event identifier |
| `owner_userId` | `text` | FK → `user.id`, NOT NULL, ON DELETE CASCADE | User whose AI interaction this tracks |
| `provider` | `text` | NOT NULL | AI provider (e.g., `openrouter`, `openai`) |
| `feature` | `text` | NOT NULL, CHECK (`chat_stream`, `text_enhance`, `task_extract`, `voice_task_extract`, `voice_cleanup`, `embedding`, `mcp_tool_call`) | Feature identifier |
| `operation` | `text` | NOT NULL, CHECK (`chat_completion`, `structured_output`, `embedding`) | Operation type |
| `model` | `text` | NOT NULL | Model identifier |
| `request_id` | `text` | nullable | Correlatable request ID |
| `input_tokens` | `integer` | NOT NULL, CHECK >= 0 | Token count for the prompt |
| `output_tokens` | `integer` | NOT NULL, CHECK >= 0 | Token count for the completion |
| `total_tokens` | `integer` | NOT NULL, CHECK >= 0 AND = input + output | Total tokens |
| `cached_input_tokens` | `integer` | CHECK >= 0, nullable | Cached prompt tokens |
| `reasoning_tokens` | `integer` | CHECK >= 0, nullable | Reasoning/thinking tokens |
| `cost_usd` | `numeric(12,8)` | CHECK >= 0, nullable | Computed cost in USD |
| `metadata` | `jsonb` | nullable | Additional context (never prompts or content) |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | Event timestamp |

**Constraints**:
- Does NOT store prompts, responses, or private-content evidence
- RLS: `owner_userId = auth.current_user_id()` OR `auth.is_service_role()`
- Indexed on `(owner_userId, createdAt DESC)`, `(owner_userId, feature, createdAt DESC)`, `(owner_userId, model, createdAt DESC)`

## Relationships

```
app.entities 1───* app.entity_links (from)
app.entities 1───* app.entity_links (to)
app.entities *───1 app.spaces (optional, via space_id)
```

## RLS Policy Summary

| Table | Owner Select | Space Member Select | Service Role |
|-------|-------------|-------------------|--------------|
| `app.entities` | Yes | Yes (if entity is in space) | Full access |
| `app.entity_links` | Yes | Yes (if link is in space) | Full access |
| `app.ai_usage_events` | Yes (own events) | No | Full access |
