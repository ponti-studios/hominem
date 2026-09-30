-- +goose Up
-- +goose StatementBegin

-- Row-level security, as on the other owner-scoped tables (see app.mcp_tokens).
ALTER TABLE app.possession_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.possession_containers FORCE ROW LEVEL SECURITY;
ALTER TABLE app.possessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.possessions FORCE ROW LEVEL SECURITY;

-- References between a user's rows must stay inside that user: a plain FK on the container id
-- would accept another user's container. Composite keys make Postgres enforce the owner too.
ALTER TABLE app.possession_containers
  ADD CONSTRAINT uq_app_possession_containers_owner_id UNIQUE (owner_userId, id);

ALTER TABLE app.possession_containers
  DROP CONSTRAINT IF EXISTS possession_containers_parent_container_id_fkey;
ALTER TABLE app.possession_containers
  ADD CONSTRAINT possession_containers_parent_owner_fkey
  FOREIGN KEY (owner_userId, parent_container_id)
  REFERENCES app.possession_containers (owner_userId, id)
  ON DELETE SET NULL (parent_container_id);

ALTER TABLE app.possessions
  DROP CONSTRAINT IF EXISTS possessions_container_id_fkey;
ALTER TABLE app.possessions
  ADD CONSTRAINT possessions_container_owner_fkey
  FOREIGN KEY (owner_userId, container_id)
  REFERENCES app.possession_containers (owner_userId, id)
  ON DELETE SET NULL (container_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.possessions DROP CONSTRAINT IF EXISTS possessions_container_owner_fkey;
ALTER TABLE app.possessions
  ADD CONSTRAINT possessions_container_id_fkey
  FOREIGN KEY (container_id) REFERENCES app.possession_containers(id) ON DELETE SET NULL;

ALTER TABLE app.possession_containers DROP CONSTRAINT IF EXISTS possession_containers_parent_owner_fkey;
ALTER TABLE app.possession_containers
  ADD CONSTRAINT possession_containers_parent_container_id_fkey
  FOREIGN KEY (parent_container_id) REFERENCES app.possession_containers(id) ON DELETE SET NULL;
ALTER TABLE app.possession_containers DROP CONSTRAINT IF EXISTS uq_app_possession_containers_owner_id;

ALTER TABLE app.possessions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.possessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.possession_containers NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.possession_containers DISABLE ROW LEVEL SECURITY;

-- +goose StatementEnd
