-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.portfolios
  ADD COLUMN open_to_remote boolean NOT NULL DEFAULT false;

ALTER TABLE app.portfolios
  DROP COLUMN IF EXISTS location_tagline;

ALTER TABLE app.portfolios
  DROP COLUMN IF EXISTS availability_message;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.portfolios
  ADD COLUMN location_tagline text;

ALTER TABLE app.portfolios
  ADD COLUMN availability_message text;

ALTER TABLE app.portfolios
  DROP COLUMN IF EXISTS open_to_remote;
-- +goose StatementEnd
