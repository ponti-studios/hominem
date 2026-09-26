-- +goose Up
-- +goose StatementBegin
CREATE UNIQUE INDEX app_notes_memory_owner_content_key
  ON app.notes (owner_userid, kind, content)
  WHERE kind = 'memory';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS app.app_notes_memory_owner_content_key;
-- +goose StatementEnd
