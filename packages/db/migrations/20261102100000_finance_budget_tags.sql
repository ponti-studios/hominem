-- +goose Up
-- +goose StatementBegin
-- Nested budgets: a budget row with `tag_id` NULL is the category budget (the breach line);
-- a row with `tag_id` set is a tag budget nested inside that same category, for composition
-- tracking only. Both carry their own cadence, exactly like a category budget.
ALTER TABLE app.finance_budgets ADD COLUMN IF NOT EXISTS tag_id uuid;

-- The single-budget-per-category rule now excludes tag budgets: one category budget and one
-- budget per tag inside it. Partial indexes because a NULL tag id is not equal to itself.
ALTER TABLE app.finance_budgets DROP CONSTRAINT IF EXISTS finance_budgets_user_category_key;

CREATE UNIQUE INDEX IF NOT EXISTS finance_budgets_user_category_key
  ON app.finance_budgets (user_id, category_id)
  WHERE tag_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS finance_budgets_user_category_tag_key
  ON app.finance_budgets (user_id, category_id, tag_id)
  WHERE tag_id IS NOT NULL;

-- A tag budget belongs to a tag its owner holds. The composite key makes that a database
-- fact rather than a repository convention, and deleting the tag removes its budget.
CREATE UNIQUE INDEX IF NOT EXISTS app_tags_id_owner_key
  ON app.tags (id, owner_userid);

ALTER TABLE app.finance_budgets
  DROP CONSTRAINT IF EXISTS finance_budgets_tag_owner_fk,
  ADD CONSTRAINT finance_budgets_tag_owner_fk
    FOREIGN KEY (tag_id, user_id)
    REFERENCES app.tags(id, owner_userid) ON DELETE CASCADE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Tag budgets cannot exist in the pre-nested model, and leaving them would break the restored
-- one-budget-per-category constraint.
DELETE FROM app.finance_budgets WHERE tag_id IS NOT NULL;
DROP INDEX IF EXISTS app.finance_budgets_user_category_tag_key;
DROP INDEX IF EXISTS app.finance_budgets_user_category_key;
ALTER TABLE app.finance_budgets
  DROP CONSTRAINT IF EXISTS finance_budgets_tag_owner_fk,
  DROP COLUMN IF EXISTS tag_id;
ALTER TABLE app.finance_budgets
  ADD CONSTRAINT finance_budgets_user_category_key UNIQUE (user_id, category_id);
DROP INDEX IF EXISTS app.app_tags_id_owner_key;
-- +goose StatementEnd
