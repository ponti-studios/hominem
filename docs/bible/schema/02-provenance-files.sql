-- Reconciled Up: real import-provenance chain plus the simpler, non-content-addressed app.files model.
CREATE TABLE app.import_sources (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (btrim(provider) <> ''), source_kind text NOT NULL CHECK (btrim(source_kind) <> ''),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''), external_account_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','needs_attention','revoked')),
  sync_cursor text, last_synced_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.import_runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(), source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','completed_with_warnings','failed','cancelled')),
  input_object_key text, input_checksum text,
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0), records_imported integer NOT NULL DEFAULT 0 CHECK (records_imported >= 0), records_rejected integer NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  started_at timestamptz, completed_at timestamptz, error_summary text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE TABLE app.import_artifacts (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL, import_run_id uuid REFERENCES app.import_runs(id) ON DELETE SET NULL,
  object_key text NOT NULL, content_hash text NOT NULL, byte_size bigint NOT NULL CHECK (byte_size >= 0), media_type text NOT NULL, original_filename text,
  retention_class text NOT NULL DEFAULT 'permanent' CHECK (retention_class IN ('permanent','legal_hold')), metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.import_records (
  id uuid PRIMARY KEY DEFAULT uuidv7(), source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE, import_run_id uuid NOT NULL REFERENCES app.import_runs(id) ON DELETE CASCADE,
  external_id text NOT NULL CHECK (btrim(external_id) <> ''), external_version text, record_type text NOT NULL CHECK (btrim(record_type) <> ''),
  content_hash text NOT NULL CHECK (btrim(content_hash) <> ''), raw_object_key text, occurred_at timestamptz, observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.import_record_payloads (
  source_record_id uuid NOT NULL REFERENCES app.import_records(id) ON DELETE CASCADE, artifact_id uuid NOT NULL REFERENCES app.import_artifacts(id) ON DELETE RESTRICT,
  payload_offset bigint CHECK (payload_offset IS NULL OR payload_offset >= 0), payload_length integer CHECK (payload_length IS NULL OR payload_length >= 0),
  payload_hash text NOT NULL, createdAt timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (source_record_id, artifact_id)
);
CREATE TABLE app.entity_source_records (
  id uuid PRIMARY KEY DEFAULT uuidv7(), source_record_id uuid NOT NULL REFERENCES app.import_records(id) ON DELETE CASCADE,
  canonical_entity_table regclass NOT NULL, canonical_entity_id uuid NOT NULL,
  mapping_kind text NOT NULL DEFAULT 'primary' CHECK (mapping_kind IN ('primary','derived','reviewed')), confidence numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.import_review_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(), source_record_id uuid NOT NULL REFERENCES app.import_records(id) ON DELETE CASCADE,
  review_kind text NOT NULL CHECK (btrim(review_kind) <> ''), status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','superseded')),
  proposed_entity_table regclass, proposed_entity_id uuid, proposed_change jsonb NOT NULL DEFAULT '{}', resolution jsonb,
  reviewed_at timestamptz, reviewed_by_userid text, createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewed_at IS NULL OR reviewed_at >= createdAt)
);
CREATE TABLE app.import_reconciliations (
  id uuid PRIMARY KEY DEFAULT uuidv7(), import_run_id uuid NOT NULL REFERENCES app.import_runs(id) ON DELETE CASCADE,
  entity_kind text NOT NULL CHECK (btrim(entity_kind) <> ''), source_count integer NOT NULL CHECK (source_count >= 0), canonical_count integer NOT NULL CHECK (canonical_count >= 0),
  source_checksum text, canonical_checksum text, status text NOT NULL CHECK (status IN ('matched','warning','failed')), details jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now()
);
-- app.files is intentionally NOT content-addressed and has no artifact/file_links layer; see chapter prose.
CREATE TABLE app.files (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  storage_key text NOT NULL, original_name text NOT NULL, mimetype text NOT NULL, size integer NOT NULL, url text NOT NULL,
  content text, text_content text, metadata jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.note_files (
  note_id uuid NOT NULL, file_id uuid NOT NULL REFERENCES app.files(id) ON DELETE CASCADE,
  attached_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (note_id, file_id)
);
ALTER TABLE app.entity_attributes ADD CONSTRAINT entity_attributes_source_record_id_fkey FOREIGN KEY (source_record_id) REFERENCES app.import_records(id) ON DELETE SET NULL;
CREATE INDEX idx_import_records_source_external ON app.import_records(source_id, external_id);
CREATE INDEX idx_entity_source_records_canonical ON app.entity_source_records(canonical_entity_table, canonical_entity_id);
