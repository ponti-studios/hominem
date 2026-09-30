-- +goose Up
-- +goose StatementBegin

-- Containers hold possessions (suitcase, pouch, shelf) and can nest via parent_container_id.
-- external_id keeps an id from an import source (e.g. a spreadsheet's CON-023) so re-running
-- an import updates rows instead of duplicating them.
CREATE TABLE IF NOT EXISTS app.possession_containers (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  container_type text,
  container_kind text,
  status text NOT NULL DEFAULT 'active',
  parent_container_id uuid REFERENCES app.possession_containers(id) ON DELETE SET NULL,
  description text,
  current_location text,
  weight_kg numeric(8,3),
  volume_cbm numeric(8,3),
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_container_id IS NULL OR parent_container_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_app_possession_containers_owner
  ON app.possession_containers(owner_userId);
CREATE INDEX IF NOT EXISTS idx_app_possession_containers_parent
  ON app.possession_containers(parent_container_id) WHERE parent_container_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_possession_containers_external
  ON app.possession_containers(owner_userId, external_id) WHERE external_id IS NOT NULL;
CREATE TRIGGER app_possession_containers_set_updated_at
  BEFORE UPDATE ON app.possession_containers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY app_possession_containers_owner_policy ON app.possession_containers
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

ALTER TABLE app.possessions
  ADD COLUMN IF NOT EXISTS container_id uuid REFERENCES app.possession_containers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS currency_code text;
CREATE INDEX IF NOT EXISTS idx_app_possessions_container
  ON app.possessions(container_id) WHERE container_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_possessions_external
  ON app.possessions(owner_userId, external_id) WHERE external_id IS NOT NULL;

-- The buying lifecycle (wishlist -> planned -> ordered -> delivered -> owned) plus the end states.
ALTER TABLE app.possessions DROP CONSTRAINT IF EXISTS possessions_status_check;
ALTER TABLE app.possessions ADD CONSTRAINT possessions_status_check CHECK (
  status IS NULL OR status IN
    ('wishlist', 'planned', 'ordered', 'delivered', 'owned', 'in_use', 'retired', 'disposed')
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.possessions DROP CONSTRAINT IF EXISTS possessions_status_check;
UPDATE app.possessions SET status = 'wishlist' WHERE status IN ('planned', 'ordered');
UPDATE app.possessions SET status = 'owned' WHERE status = 'delivered';
ALTER TABLE app.possessions ADD CONSTRAINT possessions_status_check CHECK (
  status IS NULL OR status IN ('in_use', 'owned', 'wishlist', 'disposed', 'retired')
);
DROP INDEX IF EXISTS app.uq_app_possessions_external;
DROP INDEX IF EXISTS app.idx_app_possessions_container;
ALTER TABLE app.possessions
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS external_id,
  DROP COLUMN IF EXISTS container_id;
DROP TABLE IF EXISTS app.possession_containers;

-- +goose StatementEnd
