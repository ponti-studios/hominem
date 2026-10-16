-- +goose Up
-- +goose StatementBegin

-- Durable delete log for library sync. Deletes in this domain are hard deletes
-- (rows vanish; even possession_events cascade away), so delta sync needs its
-- own record of what disappeared. Every remove path writes one row per deleted
-- entity in the same transaction as the delete.
--
-- Convention: collection_id NULL means the entity itself was deleted;
-- collection_id SET means a membership link was removed (the entity lives on).
-- A collection delete tombstones only the collection: its links vanish by FK
-- cascade, and clients drop them with the collection. A possession delete
-- leaves orphan links behind (no FK); clients drop links to a tombstoned id.
CREATE TABLE IF NOT EXISTS app.sync_tombstones (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_table text NOT NULL CHECK (entity_table IN
    ('app.possessions', 'app.possession_containers', 'app.collections', 'app.collection_items')),
  entity_id uuid NOT NULL,
  collection_id uuid NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_sync_tombstones_owner
  ON app.sync_tombstones(owner_userId, deleted_at);
ALTER TABLE app.sync_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sync_tombstones FORCE ROW LEVEL SECURITY;
CREATE POLICY app_sync_tombstones_owner_policy ON app.sync_tombstones
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS app.sync_tombstones;

-- +goose StatementEnd
