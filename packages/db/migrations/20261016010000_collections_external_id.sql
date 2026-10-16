-- +goose Up
-- +goose StatementBegin

-- Collections gain an external id so a client can create one idempotently: the
-- offline outbox sends its own UUID and re-sending (after a crash, or on a
-- repeated flush) updates the same row instead of duplicating it. Mirrors
-- app.possessions/app.possession_containers.
ALTER TABLE app.collections ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_collections_external
  ON app.collections(owner_userId, external_id) WHERE external_id IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.uq_app_collections_external;
ALTER TABLE app.collections DROP COLUMN IF EXISTS external_id;

-- +goose StatementEnd
