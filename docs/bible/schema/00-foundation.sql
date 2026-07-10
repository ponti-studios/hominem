-- Reconciled Up: matches the live `app` schema foundation as of this reconciliation pass.
-- PostgreSQL extensions, namespace, and cross-domain primitives.
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

-- Lightweight owner-scoped registry: lets tags/spaces/links reference any domain row by (entity_table, entity_id)
-- without becoming a domain-data table itself. Domain facts always live in their own typed table.
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

-- Sparse, namespaced key/value facts about any entity (e.g. AI-derived attributes) without a schema migration
-- per attribute. source_record_id informally references app.import_records(id), added via ALTER TABLE after ch.02.
CREATE TABLE app.entity_attributes (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_table regclass NOT NULL, entity_id uuid NOT NULL, namespace text NOT NULL CHECK (btrim(namespace) <> ''),
  attribute_key text NOT NULL CHECK (btrim(attribute_key) <> ''), value jsonb NOT NULL, source_record_id uuid,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);

-- Tags are hierarchical (ltree path), can be applied by a user, an agent, an import rule, or a rule engine,
-- and record when an assignment was removed rather than deleting the row (assignment_period).
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
  assignment_source text NOT NULL DEFAULT 'user' CHECK (assignment_source IN ('user','agent','import','rule')),
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1), assigned_by_userid text, removed_at timestamptz,
  assignment_period tstzrange GENERATED ALWAYS AS (tstzrange(createdAt, coalesce(removed_at, 'infinity'), '[)')) STORED,
  createdAt timestamptz NOT NULL DEFAULT now()
);
-- ops.* tables are the actual audit mechanism: service-role RLS, not owner-scoped. See 01-identity-access.sql.
CREATE INDEX idx_entities_owner ON app.entities(owner_userid);
CREATE INDEX idx_entity_links_owner_from ON app.entity_links(owner_userid, from_entity_table, from_entity_id);
CREATE INDEX idx_tag_assignments_entity ON app.tag_assignments(entity_table, entity_id);
