-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.portfolios
  DROP CONSTRAINT IF EXISTS app_portfolios_owner_userId_key;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.portfolios
  ADD CONSTRAINT app_portfolios_owner_userId_key UNIQUE (owner_userId);
-- +goose StatementEnd
