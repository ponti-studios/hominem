-- +goose Up
-- +goose StatementBegin

-- Transfer linking: a transaction may point at its counterpart (the other leg of an internal
-- transfer). ON DELETE SET NULL means deleting one leg clears the link on the other with no
-- application code. The link is mirrored by the write path (both rows point at each other);
-- there is no auto-detection — a client proposes the pairing.
ALTER TABLE app.finance_transactions
  ADD COLUMN IF NOT EXISTS counterpart_id uuid
    REFERENCES app.finance_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_finance_transactions_counterpart_idx
  ON app.finance_transactions (counterpart_id)
  WHERE counterpart_id IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.app_finance_transactions_counterpart_idx;
ALTER TABLE app.finance_transactions DROP COLUMN IF EXISTS counterpart_id;

-- +goose StatementEnd
