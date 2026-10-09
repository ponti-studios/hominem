-- +goose Up
-- +goose StatementBegin

-- GET /api/memory pages one person's memories newest first (created, then id). This index serves
-- that walk without sorting every memory the person has on each page.
CREATE INDEX IF NOT EXISTS app_notes_owner_kind_created_idx
  ON app.notes (owner_userid, kind, createdat DESC, id DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.app_notes_owner_kind_created_idx;

-- +goose StatementEnd
