-- +goose Up
-- +goose StatementBegin

DROP TABLE IF EXISTS ops.search_logs;
DROP TABLE IF EXISTS ops.audit_logs;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE ops.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_userId text REFERENCES "user"(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_schema text,
  entity_table text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ops.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_userId text REFERENCES "user"(id) ON DELETE SET NULL,
  query text NOT NULL,
  scope text,
  results_count integer,
  clicked_entity_type text,
  clicked_entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ops.audit_logs
  ADD CONSTRAINT ops_audit_logs_action_not_blank CHECK (length(btrim(action)) > 0),
  ADD CONSTRAINT ops_audit_logs_entity_schema_not_blank CHECK (
    entity_schema IS NULL OR length(btrim(entity_schema)) > 0
  ),
  ADD CONSTRAINT ops_audit_logs_entity_table_not_blank CHECK (
    entity_table IS NULL OR length(btrim(entity_table)) > 0
  );

ALTER TABLE ops.search_logs
  ADD CONSTRAINT ops_search_logs_query_not_blank CHECK (length(btrim(query)) > 0),
  ADD CONSTRAINT ops_search_logs_scope_not_blank CHECK (
    scope IS NULL OR length(btrim(scope)) > 0
  ),
  ADD CONSTRAINT ops_search_logs_results_count_check CHECK (
    results_count IS NULL OR results_count >= 0
  ),
  ADD CONSTRAINT ops_search_logs_clicked_entity_type_not_blank CHECK (
    clicked_entity_type IS NULL OR length(btrim(clicked_entity_type)) > 0
  );

CREATE INDEX IF NOT EXISTS ops_audit_logs_createdAt_idx
  ON ops.audit_logs (createdAt DESC);

CREATE INDEX IF NOT EXISTS ops_audit_logs_actor_createdAt_idx
  ON ops.audit_logs (actor_userId, createdAt DESC)
  WHERE actor_userId IS NOT NULL;

CREATE INDEX IF NOT EXISTS ops_audit_logs_entity_idx
  ON ops.audit_logs (entity_schema, entity_table, entity_id, createdAt DESC)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ops_search_logs_createdAt_idx
  ON ops.search_logs (createdAt DESC);

CREATE INDEX IF NOT EXISTS ops_search_logs_actor_createdAt_idx
  ON ops.search_logs (actor_userId, createdAt DESC)
  WHERE actor_userId IS NOT NULL;

CREATE INDEX IF NOT EXISTS ops_search_logs_query_idx
  ON ops.search_logs USING gin (query gin_trgm_ops);

ALTER TABLE ops.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE ops.search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.search_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY ops_audit_logs_service_policy ON ops.audit_logs
  FOR ALL
  USING (auth.is_service_role())
  WITH CHECK (auth.is_service_role());

CREATE POLICY ops_search_logs_service_policy ON ops.search_logs
  FOR ALL
  USING (auth.is_service_role())
  WITH CHECK (auth.is_service_role());

-- +goose StatementEnd
