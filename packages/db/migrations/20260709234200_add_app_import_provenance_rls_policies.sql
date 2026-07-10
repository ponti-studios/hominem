-- +goose Up
-- +goose StatementBegin

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

CREATE POLICY app_import_sources_owner_policy ON app.import_sources
  FOR ALL
  USING (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  )
  WITH CHECK (
    auth.is_service_role()
    OR owner_userId = auth.current_user_id()
  );

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

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP POLICY IF EXISTS app_import_review_items_owner_policy ON app.import_review_items;
DROP POLICY IF EXISTS app_entity_source_records_owner_policy ON app.entity_source_records;
DROP POLICY IF EXISTS app_import_records_owner_policy ON app.import_records;
DROP POLICY IF EXISTS app_import_runs_owner_policy ON app.import_runs;
DROP POLICY IF EXISTS app_import_sources_owner_policy ON app.import_sources;

ALTER TABLE app.import_review_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.entity_source_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.import_sources DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS auth.owns_import_source(uuid);

-- +goose StatementEnd
