-- +goose Up
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
  updatedAt timestamptz NOT NULL DEFAULT now()
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
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.import_records (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  import_run_id uuid NOT NULL REFERENCES app.import_runs(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  external_version text,
  record_type text NOT NULL,
  content_hash text NOT NULL,
  raw_object_key text,
  occurred_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now()
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
  updatedAt timestamptz NOT NULL DEFAULT now()
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
  updatedAt timestamptz NOT NULL DEFAULT now()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS app.import_review_items;
DROP TABLE IF EXISTS app.entity_source_records;
DROP TABLE IF EXISTS app.import_records;
DROP TABLE IF EXISTS app.import_runs;
DROP TABLE IF EXISTS app.import_sources;

-- +goose StatementEnd
