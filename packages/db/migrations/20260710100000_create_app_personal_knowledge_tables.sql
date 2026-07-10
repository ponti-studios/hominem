-- +goose Up
-- +goose StatementBegin

-- Lossless import retention. Object bytes live in private R2 storage; this table
-- is the immutable, owner-scoped manifest and never exposes storage paths to clients.
CREATE TABLE app.import_artifacts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL,
  import_run_id uuid REFERENCES app.import_runs(id) ON DELETE SET NULL,
  object_key text NOT NULL,
  content_hash text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  media_type text NOT NULL,
  original_filename text,
  retention_class text NOT NULL DEFAULT 'permanent' CHECK (retention_class IN ('permanent', 'legal_hold')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, content_hash)
);

CREATE TABLE app.import_record_payloads (
  source_record_id uuid PRIMARY KEY REFERENCES app.import_records(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL REFERENCES app.import_artifacts(id) ON DELETE RESTRICT,
  payload_offset bigint,
  payload_length integer,
  payload_hash text NOT NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  CHECK (payload_offset IS NULL OR payload_offset >= 0),
  CHECK (payload_length IS NULL OR payload_length >= 0)
);

CREATE TABLE app.import_reconciliations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  import_run_id uuid NOT NULL REFERENCES app.import_runs(id) ON DELETE CASCADE,
  entity_kind text NOT NULL CHECK (length(btrim(entity_kind)) > 0),
  source_count integer NOT NULL CHECK (source_count >= 0),
  canonical_count integer NOT NULL CHECK (canonical_count >= 0),
  source_checksum text,
  canonical_checksum text,
  status text NOT NULL CHECK (status IN ('matched', 'warning', 'failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now()
);

-- Calendar complements the existing event/occurrence model with the source
-- calendar identity needed for multi-calendar imports.
CREATE TABLE app.calendars (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL,
  external_id text,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  color text,
  timezone text,
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (source_id, external_id)
);

ALTER TABLE app.calendar_event_sources
  ADD COLUMN calendar_id uuid REFERENCES app.calendars(id) ON DELETE SET NULL;

-- Identity and relationship records normalize the existing app.people table.
CREATE TABLE app.organizations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  website_url text,
  kind text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.person_aliases (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (length(btrim(alias)) > 0),
  alias_kind text NOT NULL DEFAULT 'name',
  createdAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, alias, alias_kind)
);

CREATE TABLE app.person_contact_methods (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('email', 'phone', 'address', 'url', 'handle')),
  value text NOT NULL CHECK (length(btrim(value)) > 0),
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, kind, value)
);

CREATE TABLE app.person_relationships (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  to_person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (length(btrim(relationship_type)) > 0),
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (from_person_id <> to_person_id),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE app.organization_memberships (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  role text,
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE app.place_visits (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES app.places(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  purpose text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE app.travel_segments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES app.travel_trips(id) ON DELETE CASCADE,
  segment_type text NOT NULL CHECK (segment_type IN ('flight', 'rail', 'road', 'lodging', 'other')),
  provider text,
  confirmation_code text,
  departs_at timestamptz,
  arrives_at timestamptz,
  origin_place_id uuid REFERENCES app.places(id) ON DELETE SET NULL,
  destination_place_id uuid REFERENCES app.places(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (arrives_at IS NULL OR departs_at IS NULL OR arrives_at >= departs_at)
);

-- Finance extends transaction imports without displacing the live Plaid model.
CREATE TABLE app.finance_merchants (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  normalized_name text NOT NULL CHECK (length(btrim(normalized_name)) > 0),
  website_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, normalized_name)
);

CREATE TABLE app.finance_categories (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES app.finance_categories(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('income', 'expense', 'transfer', 'asset', 'liability')),
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, parent_id, name)
);

CREATE TABLE app.finance_transaction_postings (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES app.finance_transactions(id) ON DELETE CASCADE,
  account_id uuid REFERENCES app.finance_accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES app.finance_categories(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  memo text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.finance_statement_periods (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES app.finance_accounts(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  opening_balance numeric(14,2),
  closing_balance numeric(14,2),
  statement_artifact_id uuid REFERENCES app.import_artifacts(id) ON DELETE SET NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (account_id, starts_on, ends_on)
);

CREATE TABLE app.health_observations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  observation_type text NOT NULL CHECK (length(btrim(observation_type)) > 0),
  value numeric,
  unit text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.health_activities (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (length(btrim(activity_type)) > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  source text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE app.media_works (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  work_type text NOT NULL CHECK (work_type IN ('book', 'article', 'podcast', 'film', 'show', 'game', 'other')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  creators jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (owner_userId, work_type, external_id)
);

CREATE TABLE app.media_consumptions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  media_work_id uuid NOT NULL REFERENCES app.media_works(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'abandoned')),
  started_at timestamptz,
  completed_at timestamptz,
  progress numeric(7,2),
  rating numeric(3,1),
  notes text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (progress IS NULL OR progress >= 0),
  CHECK (rating IS NULL OR rating >= 0 AND rating <= 10),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE app.purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES app.finance_merchants(id) ON DELETE SET NULL,
  ordered_at timestamptz,
  status text,
  currency_code text NOT NULL DEFAULT 'USD',
  total_amount numeric(14,2),
  source text,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (owner_userId, source, external_id)
);

CREATE TABLE app.purchase_line_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES app.purchase_orders(id) ON DELETE CASCADE,
  possession_id uuid REFERENCES app.possessions(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount numeric(14,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.communication_threads (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL,
  external_id text,
  title text,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'signal', 'social', 'other')),
  sensitivity text NOT NULL DEFAULT 'private' CHECK (sensitivity IN ('private', 'sensitive', 'restricted')),
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (source_id, external_id)
);

CREATE TABLE app.communication_messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES app.communication_threads(id) ON DELETE CASCADE,
  sender_person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  external_id text,
  sent_at timestamptz NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'unknown')),
  body_artifact_id uuid REFERENCES app.import_artifacts(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (thread_id, external_id)
);

CREATE TABLE app.social_interactions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL,
  interaction_type text NOT NULL CHECK (length(btrim(interaction_type)) > 0),
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

-- Bounded provider fields that have no stable product meaning yet. This is not
-- a generic product query surface; callers must resolve a canonical entity first.
CREATE TABLE app.entity_attributes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_table regclass NOT NULL,
  entity_id uuid NOT NULL,
  namespace text NOT NULL CHECK (length(btrim(namespace)) > 0),
  attribute_key text NOT NULL CHECK (length(btrim(attribute_key)) > 0),
  value jsonb NOT NULL,
  source_record_id uuid REFERENCES app.import_records(id) ON DELETE SET NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_table, entity_id, namespace, attribute_key)
);

CREATE TABLE app.extracted_facts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject_table regclass,
  subject_id uuid,
  predicate text NOT NULL CHECK (length(btrim(predicate)) > 0),
  object_value jsonb NOT NULL,
  source_record_id uuid REFERENCES app.import_records(id) ON DELETE SET NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  observed_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_import_artifacts_owner_created_idx ON app.import_artifacts (owner_userId, createdAt DESC);
CREATE INDEX app_import_reconciliations_run_idx ON app.import_reconciliations (import_run_id, createdAt DESC);
CREATE INDEX app_calendar_owner_starts_idx ON app.calendars (owner_userId, name);
CREATE INDEX app_place_visits_owner_started_idx ON app.place_visits (owner_userId, started_at DESC);
CREATE INDEX app_finance_postings_transaction_idx ON app.finance_transaction_postings (transaction_id);
CREATE INDEX app_finance_statement_account_period_idx ON app.finance_statement_periods (account_id, ends_on DESC);
CREATE INDEX app_health_observations_owner_observed_idx ON app.health_observations (owner_userId, observed_at DESC);
CREATE INDEX app_health_activities_owner_started_idx ON app.health_activities (owner_userId, starts_at DESC);
CREATE INDEX app_media_consumptions_owner_status_idx ON app.media_consumptions (owner_userId, status);
CREATE INDEX app_purchase_orders_owner_ordered_idx ON app.purchase_orders (owner_userId, ordered_at DESC);
CREATE INDEX app_communication_messages_thread_sent_idx ON app.communication_messages (thread_id, sent_at DESC);
CREATE INDEX app_entity_attributes_entity_idx ON app.entity_attributes (entity_table, entity_id);
CREATE INDEX app_extracted_facts_subject_idx ON app.extracted_facts (subject_table, subject_id);

-- All new tables carry their own owner ID so RLS remains simple, auditable,
-- and safe for both direct API and future remote MCP callers.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'import_artifacts', 'calendars', 'organizations', 'person_aliases',
    'person_contact_methods', 'person_relationships', 'organization_memberships',
    'place_visits', 'travel_segments', 'finance_merchants', 'finance_categories',
    'finance_transaction_postings', 'finance_statement_periods', 'health_observations',
    'health_activities', 'media_works', 'media_consumptions', 'purchase_orders',
    'purchase_line_items', 'communication_threads', 'communication_messages',
    'social_interactions', 'entity_attributes', 'extracted_facts'
  ] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON app.%I FOR ALL USING (auth.is_service_role() OR owner_userId = auth.current_user_id()) WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id())',
      'app_' || table_name || '_owner_policy', table_name
    );
  END LOOP;
END $$;

ALTER TABLE app.import_record_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_record_payloads FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY app_import_record_payloads_owner_policy ON app.import_record_payloads
  FOR ALL USING (
    auth.is_service_role() OR EXISTS (
      SELECT 1 FROM app.import_records record WHERE record.id = import_record_payloads.source_record_id
      AND auth.owns_import_source(record.source_id)
    )
  ) WITH CHECK (
    auth.is_service_role() OR EXISTS (
      SELECT 1 FROM app.import_records record WHERE record.id = import_record_payloads.source_record_id
      AND auth.owns_import_source(record.source_id)
    )
  );

CREATE POLICY app_import_reconciliations_owner_policy ON app.import_reconciliations
  FOR ALL USING (
    auth.is_service_role() OR EXISTS (
      SELECT 1 FROM app.import_runs run WHERE run.id = import_reconciliations.import_run_id
      AND auth.owns_import_source(run.source_id)
    )
  ) WITH CHECK (
    auth.is_service_role() OR EXISTS (
      SELECT 1 FROM app.import_runs run WHERE run.id = import_reconciliations.import_run_id
      AND auth.owns_import_source(run.source_id)
    )
  );

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS app.extracted_facts;
DROP TABLE IF EXISTS app.entity_attributes;
DROP TABLE IF EXISTS app.social_interactions;
DROP TABLE IF EXISTS app.communication_messages;
DROP TABLE IF EXISTS app.communication_threads;
DROP TABLE IF EXISTS app.purchase_line_items;
DROP TABLE IF EXISTS app.purchase_orders;
DROP TABLE IF EXISTS app.media_consumptions;
DROP TABLE IF EXISTS app.media_works;
DROP TABLE IF EXISTS app.health_activities;
DROP TABLE IF EXISTS app.health_observations;
DROP TABLE IF EXISTS app.finance_statement_periods;
DROP TABLE IF EXISTS app.finance_transaction_postings;
DROP TABLE IF EXISTS app.finance_categories;
DROP TABLE IF EXISTS app.finance_merchants;
DROP TABLE IF EXISTS app.travel_segments;
DROP TABLE IF EXISTS app.place_visits;
DROP TABLE IF EXISTS app.organization_memberships;
DROP TABLE IF EXISTS app.person_relationships;
DROP TABLE IF EXISTS app.person_contact_methods;
DROP TABLE IF EXISTS app.person_aliases;
DROP TABLE IF EXISTS app.organizations;
ALTER TABLE app.calendar_event_sources DROP COLUMN IF EXISTS calendar_id;
DROP TABLE IF EXISTS app.calendars;
DROP TABLE IF EXISTS app.import_reconciliations;
DROP TABLE IF EXISTS app.import_record_payloads;
DROP TABLE IF EXISTS app.import_artifacts;

-- +goose StatementEnd
