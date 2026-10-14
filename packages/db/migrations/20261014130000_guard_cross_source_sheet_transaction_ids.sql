-- +goose Up
-- Sheet transaction hashes intentionally omit source so the same ledger row can be
-- matched across bank feeds. Serialize inserts for that identity without rewriting
-- existing ledger rows or changing provider-scoped external-id uniqueness.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.guard_sheet_transaction_external_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.external_id IS NULL OR NEW.external_id NOT LIKE 'sheet:%' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.external_id IS NOT DISTINCT FROM OLD.external_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.user_id || ':' || NEW.external_id, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM app.finance_transactions AS existing
    WHERE existing.user_id = NEW.user_id
      AND existing.external_id = NEW.external_id
      AND existing.id <> NEW.id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      CONSTRAINT = 'app_finance_transactions_owner_sheet_external_key',
      MESSAGE = 'duplicate sheet transaction external id';
  END IF;

  RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER app_finance_transactions_sheet_external_id_guard
BEFORE INSERT OR UPDATE ON app.finance_transactions
FOR EACH ROW
EXECUTE FUNCTION app.guard_sheet_transaction_external_id();

-- +goose Down
DROP TRIGGER IF EXISTS app_finance_transactions_sheet_external_id_guard
  ON app.finance_transactions;
DROP FUNCTION IF EXISTS app.guard_sheet_transaction_external_id();
