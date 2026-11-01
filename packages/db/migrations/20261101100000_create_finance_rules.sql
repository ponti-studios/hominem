-- +goose Up
-- +goose StatementBegin
-- Owner-scoped automation rules whose action names the category a matching transaction is filed
-- into (docs/hominem-finance-tools-spec.md §8). The matching engine is not part of this table;
-- what matters here is that a rule points at a category by id, which is what makes a category
-- merge able to repoint it and able to refuse to complete while the reference survives.
CREATE TABLE app.finance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  -- How the pattern is matched against a transaction description. Kept as data, not behaviour:
  -- the engine that consumes it is a separate change.
  match_mode text NOT NULL DEFAULT 'contains'
    CHECK (match_mode IN ('exact', 'contains', 'regex')),
  match_pattern text NOT NULL CHECK (length(btrim(match_pattern)) > 0),
  action_category_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- RESTRICT, not CASCADE: dropping a category out from under its rules would silently lose the
  -- automation. A merge must repoint the rules first, and delete must refuse.
  CONSTRAINT finance_rules_category_owner_fk
    FOREIGN KEY (action_category_id, user_id)
    REFERENCES app.finance_categories(id, user_id) ON DELETE RESTRICT
);

-- Rule names are the handle a user (and an error message) refers to, so they are unique per
-- owner case-insensitively — the same identity rule categories and tags use.
CREATE UNIQUE INDEX finance_rules_user_name_key ON app.finance_rules (user_id, lower(name));
CREATE INDEX finance_rules_action_category_idx ON app.finance_rules (action_category_id);
CREATE INDEX finance_rules_user_enabled_idx ON app.finance_rules (user_id, enabled, priority);

CREATE TRIGGER finance_rules_set_updated_at
  BEFORE UPDATE ON app.finance_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_snake();

ALTER TABLE app.finance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_rules_owner_policy ON app.finance_rules
  FOR ALL USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());

-- A merge preserves each source category as a tag on its transactions. That write is neither a
-- user action nor an import, so it gets its own provenance value rather than being mislabelled.
ALTER TABLE app.tag_assignments
  DROP CONSTRAINT app_tag_assignments_assignment_source_check,
  ADD CONSTRAINT app_tag_assignments_assignment_source_check CHECK (
    assignment_source IN ('user', 'agent', 'import', 'rule', 'merge')
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Rows written by a merge keep their assignments; only the provenance value goes away, because
-- the restored constraint would reject them.
UPDATE app.tag_assignments
  SET assignment_source = 'user'
  WHERE assignment_source = 'merge';

ALTER TABLE app.tag_assignments
  DROP CONSTRAINT app_tag_assignments_assignment_source_check,
  ADD CONSTRAINT app_tag_assignments_assignment_source_check CHECK (
    assignment_source IN ('user', 'agent', 'import', 'rule')
  );

DROP TABLE IF EXISTS app.finance_rules;
-- +goose StatementEnd
