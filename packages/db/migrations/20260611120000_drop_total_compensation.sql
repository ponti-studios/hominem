-- +goose Up
ALTER TABLE app.work_experiences DROP COLUMN total_compensation;

-- +goose Down
ALTER TABLE app.work_experiences ADD COLUMN total_compensation integer;
