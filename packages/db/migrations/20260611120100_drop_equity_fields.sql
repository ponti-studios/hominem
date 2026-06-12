-- +goose Up
ALTER TABLE app.work_experiences DROP COLUMN equity_value;
ALTER TABLE app.work_experiences DROP COLUMN equity_percentage;

-- +goose Down
ALTER TABLE app.work_experiences ADD COLUMN equity_value integer;
ALTER TABLE app.work_experiences ADD COLUMN equity_percentage text;
