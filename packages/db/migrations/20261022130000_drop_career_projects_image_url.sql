-- +goose Up
-- +goose StatementBegin

-- We no longer host or show project images. Nothing reads or writes this column.
-- IF EXISTS keeps this idempotent since CI runs goose up twice.
ALTER TABLE app.career_projects
  DROP COLUMN IF EXISTS image_url;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Structure only: the dropped URLs are not coming back.
ALTER TABLE app.career_projects
  ADD COLUMN IF NOT EXISTS image_url text;

-- +goose StatementEnd
