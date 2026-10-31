-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_tier_check;

ALTER TABLE app.billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_tier_check
  CHECK (tier IN ('core', 'ai', 'rhodium', 'iridium'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_tier_check;

ALTER TABLE app.billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_tier_check
  CHECK (tier IN ('core', 'ai'));
-- +goose StatementEnd
