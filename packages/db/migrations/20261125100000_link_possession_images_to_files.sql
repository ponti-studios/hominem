-- +goose Up
-- +goose StatementBegin
-- A possession photo is an app.files row (uploaded through the presigned pipeline) attached to a
-- possession. file_id is the link; deleting the file removes the attachment with it.
ALTER TABLE app.possession_images
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES app.files(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_possession_images_file
  ON app.possession_images(file_id) WHERE file_id IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS app.idx_app_possession_images_file;
ALTER TABLE app.possession_images DROP COLUMN IF EXISTS file_id;
-- +goose StatementEnd
