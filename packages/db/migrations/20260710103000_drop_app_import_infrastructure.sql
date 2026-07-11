-- +goose Up
-- +goose StatementBegin

ALTER TABLE app.finance_statement_periods
  DROP COLUMN IF EXISTS statement_artifact_id;

ALTER TABLE app.communication_threads
  DROP COLUMN IF EXISTS source_id;

ALTER TABLE app.communication_messages
  DROP COLUMN IF EXISTS body_artifact_id;

ALTER TABLE app.entity_attributes
  DROP COLUMN IF EXISTS source_record_id;

ALTER TABLE app.extracted_facts
  DROP COLUMN IF EXISTS source_record_id;

DROP TABLE IF EXISTS app.import_record_payloads CASCADE;
DROP TABLE IF EXISTS app.import_reconciliations CASCADE;
DROP TABLE IF EXISTS app.import_review_items CASCADE;
DROP TABLE IF EXISTS app.entity_source_records CASCADE;
DROP TABLE IF EXISTS app.import_records CASCADE;
DROP TABLE IF EXISTS app.import_artifacts CASCADE;
DROP TABLE IF EXISTS app.import_runs CASCADE;
DROP TABLE IF EXISTS app.import_sources CASCADE;

DROP FUNCTION IF EXISTS auth.owns_import_source(uuid);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE app.import_sources (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_kind text NOT NULL,
  display_name text NOT NULL,
  external_account_id text,
  status text NOT NULL DEFAULT 'active',
  sync_cursor text,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_import_sources_provider_not_blank CHECK (length(btrim(provider)) > 0),
  CONSTRAINT app_import_sources_source_kind_not_blank CHECK (length(btrim(source_kind)) > 0),
  CONSTRAINT app_import_sources_display_name_not_blank CHECK (length(btrim(display_name)) > 0),
  CONSTRAINT app_import_sources_external_account_id_not_blank CHECK (
    external_account_id IS NULL OR length(btrim(external_account_id)) > 0
  ),
  CONSTRAINT app_import_sources_status_check CHECK (
    status IN ('active', 'paused', 'needs_attention', 'revoked')
  )
);

CREATE TABLE app.import_runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  input_object_key text,
  input_checksum text,
  records_read integer NOT NULL DEFAULT 0,
  records_imported integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_import_runs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled')
  ),
  CONSTRAINT app_import_runs_record_counts_nonnegative_check CHECK (
    records_read >= 0 AND records_imported >= 0 AND records_rejected >= 0
  ),
  CONSTRAINT app_import_runs_completed_after_started_check CHECK (
    completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
  ),
  CONSTRAINT app_import_runs_id_source_id_key UNIQUE (id, source_id)
);

CREATE TABLE app.import_records (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  import_run_id uuid NOT NULL,
  external_id text NOT NULL,
  external_version text,
  record_type text NOT NULL,
  content_hash text NOT NULL,
  raw_object_key text,
  occurred_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_import_records_run_source_fkey
    FOREIGN KEY (import_run_id, source_id)
    REFERENCES app.import_runs (id, source_id)
    ON DELETE CASCADE,
  CONSTRAINT app_import_records_external_id_not_blank CHECK (length(btrim(external_id)) > 0),
  CONSTRAINT app_import_records_record_type_not_blank CHECK (length(btrim(record_type)) > 0),
  CONSTRAINT app_import_records_content_hash_not_blank CHECK (length(btrim(content_hash)) > 0),
  CONSTRAINT app_import_records_raw_object_key_not_blank CHECK (
    raw_object_key IS NULL OR length(btrim(raw_object_key)) > 0
  )
);

CREATE TABLE app.entity_source_records (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_record_id uuid NOT NULL REFERENCES app.import_records(id) ON DELETE CASCADE,
  canonical_entity_table regclass NOT NULL,
  canonical_entity_id uuid NOT NULL,
  mapping_kind text NOT NULL DEFAULT 'primary',
  confidence numeric(5,4),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_entity_source_records_mapping_kind_check CHECK (
    mapping_kind IN ('primary', 'derived', 'reviewed')
  ),
  CONSTRAINT app_entity_source_records_confidence_range_check CHECK (
    confidence IS NULL OR confidence >= 0 AND confidence <= 1
  )
);

CREATE TABLE app.import_review_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_record_id uuid NOT NULL REFERENCES app.import_records(id) ON DELETE CASCADE,
  review_kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  proposed_entity_table regclass,
  proposed_entity_id uuid,
  proposed_change jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution jsonb,
  reviewed_at timestamptz,
  reviewed_by_userId text REFERENCES "user"(id) ON DELETE SET NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_import_review_items_review_kind_not_blank CHECK (length(btrim(review_kind)) > 0),
  CONSTRAINT app_import_review_items_status_check CHECK (
    status IN ('pending', 'accepted', 'rejected', 'superseded')
  ),
  CONSTRAINT app_import_review_items_reviewed_at_check CHECK (
    reviewed_at IS NULL OR reviewed_at >= createdAt
  )
);

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
  artifact_id uuid NOT NULL REFERENCES app.import_artifacts(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX app_import_sources_owner_provider_account_key
  ON app.import_sources (owner_userId, provider, external_account_id)
  WHERE external_account_id IS NOT NULL;
CREATE INDEX app_import_sources_owner_status_idx ON app.import_sources (owner_userId, status);
CREATE INDEX app_import_runs_source_created_idx ON app.import_runs (source_id, createdAt DESC);
CREATE INDEX app_import_runs_active_idx
  ON app.import_runs (source_id, started_at DESC)
  WHERE status IN ('pending', 'running');
CREATE UNIQUE INDEX app_import_records_source_external_content_key
  ON app.import_records (source_id, external_id, content_hash);
CREATE INDEX app_import_records_source_occurred_idx
  ON app.import_records (source_id, occurred_at DESC)
  WHERE occurred_at IS NOT NULL;
CREATE INDEX app_import_records_run_idx ON app.import_records (import_run_id);
CREATE UNIQUE INDEX app_entity_source_records_source_entity_key
  ON app.entity_source_records (source_record_id, canonical_entity_table, canonical_entity_id);
CREATE INDEX app_entity_source_records_entity_idx
  ON app.entity_source_records (canonical_entity_table, canonical_entity_id);
CREATE INDEX app_import_review_items_pending_idx
  ON app.import_review_items (createdAt ASC)
  WHERE status = 'pending';
CREATE INDEX app_import_review_items_source_record_idx ON app.import_review_items (source_record_id);
CREATE INDEX app_import_artifacts_owner_created_idx ON app.import_artifacts (owner_userId, createdAt DESC);
CREATE INDEX app_import_reconciliations_run_idx
  ON app.import_reconciliations (import_run_id, createdAt DESC);

CREATE TRIGGER app_import_sources_set_updated_at
  BEFORE UPDATE ON app.import_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_import_runs_set_updated_at
  BEFORE UPDATE ON app.import_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_entity_source_records_set_updated_at
  BEFORE UPDATE ON app.entity_source_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_import_review_items_set_updated_at
  BEFORE UPDATE ON app.import_review_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION auth.owns_import_source(target_source_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, app, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.import_sources source
    WHERE source.id = target_source_id
      AND (
        auth.is_service_role()
        OR source.owner_userId = auth.current_user_id()
      )
  )
$$;

ALTER TABLE app.import_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_records FORCE ROW LEVEL SECURITY;
ALTER TABLE app.entity_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.entity_source_records FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_review_items FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_record_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_record_payloads FORCE ROW LEVEL SECURITY;
ALTER TABLE app.import_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY app_import_sources_owner_policy ON app.import_sources
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

CREATE POLICY app_import_runs_owner_policy ON app.import_runs
  FOR ALL
  USING (auth.owns_import_source(source_id))
  WITH CHECK (auth.owns_import_source(source_id));

CREATE POLICY app_import_records_owner_policy ON app.import_records
  FOR ALL
  USING (auth.owns_import_source(source_id))
  WITH CHECK (auth.owns_import_source(source_id));

CREATE POLICY app_entity_source_records_owner_policy ON app.entity_source_records
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.import_records record
      WHERE record.id = entity_source_records.source_record_id
        AND auth.owns_import_source(record.source_id)
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.import_records record
      WHERE record.id = entity_source_records.source_record_id
        AND auth.owns_import_source(record.source_id)
    )
  );

CREATE POLICY app_import_review_items_owner_policy ON app.import_review_items
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.import_records record
      WHERE record.id = import_review_items.source_record_id
        AND auth.owns_import_source(record.source_id)
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.import_records record
      WHERE record.id = import_review_items.source_record_id
        AND auth.owns_import_source(record.source_id)
    )
  );

CREATE POLICY app_import_artifacts_owner_policy ON app.import_artifacts
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

CREATE POLICY app_import_record_payloads_owner_policy ON app.import_record_payloads
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.import_records record WHERE record.id = import_record_payloads.source_record_id
      AND auth.owns_import_source(record.source_id)
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.import_records record WHERE record.id = import_record_payloads.source_record_id
      AND auth.owns_import_source(record.source_id)
    )
  );

CREATE POLICY app_import_reconciliations_owner_policy ON app.import_reconciliations
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.import_runs run WHERE run.id = import_reconciliations.import_run_id
      AND auth.owns_import_source(run.source_id)
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.import_runs run WHERE run.id = import_reconciliations.import_run_id
      AND auth.owns_import_source(run.source_id)
    )
  );

ALTER TABLE app.finance_statement_periods
  ADD COLUMN statement_artifact_id uuid REFERENCES app.import_artifacts(id) ON DELETE SET NULL;

ALTER TABLE app.communication_threads
  ADD COLUMN source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL;

ALTER TABLE app.communication_messages
  ADD COLUMN body_artifact_id uuid REFERENCES app.import_artifacts(id) ON DELETE SET NULL;

ALTER TABLE app.entity_attributes
  ADD COLUMN source_record_id uuid REFERENCES app.import_records(id) ON DELETE SET NULL;

ALTER TABLE app.extracted_facts
  ADD COLUMN source_record_id uuid REFERENCES app.import_records(id) ON DELETE SET NULL;

-- +goose StatementEnd
