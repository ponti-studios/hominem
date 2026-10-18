-- +goose Up
-- +goose StatementBegin
-- The confirmation email for a top-up states the agreed loss of the 14-day right to cancel, so it
-- is sent once per payment: claimed before it is sent (a retried or duplicate webhook cannot send a
-- second copy), marked sent after, and released if sending fails so the next delivery tries again.
-- A claim that was never completed (a crash) can be taken again once it is stale.
ALTER TABLE app.credit_payments
  ADD COLUMN confirmation_claimed_at timestamptz,
  ADD COLUMN confirmation_sent_at timestamptz;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.credit_payments
  DROP COLUMN IF EXISTS confirmation_sent_at,
  DROP COLUMN IF EXISTS confirmation_claimed_at;
-- +goose StatementEnd
