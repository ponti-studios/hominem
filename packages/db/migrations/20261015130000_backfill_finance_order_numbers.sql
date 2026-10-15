-- +goose Up
UPDATE app.finance_transactions
SET order_number = (regexp_match(notes, '(^|\n)[[:space:]]*Order #:[[:space:]]*([^\n]+)'))[2]
WHERE order_number IS NULL
  AND notes ~ '(^|\n)[[:space:]]*Order #:[[:space:]]*[^\n]+';

-- +goose Down
-- The extracted value remains represented in notes; no destructive rollback is needed.
