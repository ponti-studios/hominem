-- Up: MCP and platform foundation schema.
-- PostgreSQL extensions, namespaces, cross-domain registry primitives, and AI usage telemetry.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE FUNCTION app.current_owner_user_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.owner_user_id', true), '') $$;

CREATE FUNCTION auth.current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.current_userId', true), '') $$;

CREATE FUNCTION auth.is_service_role() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('app.is_service_role', true), ''), 'false') = 'true' $$;

-- Lightweight owner-scoped registry; typed domain tables remain canonical.
CREATE TABLE app.entities (
  entity_table regclass NOT NULL, entity_id uuid NOT NULL,
  owner_userid text REFERENCES "user"(id) ON DELETE CASCADE, primary_space_id uuid,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_table, entity_id)
);

CREATE TABLE app.entity_links (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, space_id uuid,
  from_entity_table regclass NOT NULL, from_entity_id uuid NOT NULL, relation_type text NOT NULL CHECK (btrim(relation_type) <> ''),
  to_entity_table regclass NOT NULL, to_entity_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(now(), 'infinity', '[)'), metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT isempty(valid_during)), CHECK (from_entity_table <> to_entity_table OR from_entity_id <> to_entity_id)
);

CREATE TABLE app.entity_attributes (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_table regclass NOT NULL, entity_id uuid NOT NULL, namespace text NOT NULL CHECK (btrim(namespace) <> ''),
  attribute_key text NOT NULL CHECK (btrim(attribute_key) <> ''), value jsonb NOT NULL, evidence jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.tags (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), slug text NOT NULL CHECK (btrim(slug) <> ''), path ltree NOT NULL,
  color text, icon text, description text, created_by_userid text, archived_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.tag_aliases (
  id uuid PRIMARY KEY DEFAULT uuidv7(), tag_id uuid NOT NULL REFERENCES app.tags(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (btrim(alias) <> ''), alias_slug text NOT NULL CHECK (btrim(alias_slug) <> ''), createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.tag_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(), tag_id uuid NOT NULL REFERENCES app.tags(id) ON DELETE CASCADE,
  entity_table regclass NOT NULL, entity_id uuid NOT NULL,
  assignment_source text NOT NULL DEFAULT 'user' CHECK (assignment_source IN ('user','agent','rule')),
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1), assigned_by_userid text, removed_at timestamptz,
  assignment_period tstzrange GENERATED ALWAYS AS (tstzrange(createdAt, coalesce(removed_at, 'infinity'), '[)')) STORED,
  createdAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  feature text NOT NULL CHECK (feature IN ('chat_stream','text_enhance','task_extract','voice_task_extract','voice_cleanup','embedding')),
  operation text NOT NULL CHECK (operation IN ('chat_completion','structured_output','embedding')), model text NOT NULL, request_id text,
  input_tokens integer NOT NULL CHECK (input_tokens >= 0), output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL CHECK (total_tokens >= 0 AND total_tokens = input_tokens + output_tokens),
  cached_input_tokens integer CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  reasoning_tokens integer CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  cost_usd numeric(12,8) CHECK (cost_usd IS NULL OR cost_usd >= 0), metadata jsonb, createdAt timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entities_owner ON app.entities(owner_userid);
CREATE INDEX idx_entity_links_owner_from ON app.entity_links(owner_userid, from_entity_table, from_entity_id);
CREATE INDEX idx_tag_assignments_entity ON app.tag_assignments(entity_table, entity_id);
