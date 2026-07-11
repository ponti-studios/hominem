-- Up, executed last: Hominem's RLS shape is richer than a single owner-scoped policy per table.
-- Most owner-scoped tables carry TWO policies: an ALL-command "owner_write" policy (owner or service-role can
-- insert/update/delete, and read by default) plus an additional FOR SELECT policy that widens read access via a
-- domain-specific sharing predicate. Postgres OR-combines multiple permissive policies for the same command, so
-- the net effect is: WRITE requires the owner_write predicate; SELECT requires owner_write OR the select predicate.
--
-- Sharing predicates in use, by domain (all in the `auth` schema, not `app`):
--   auth.current_user_id(), auth.is_service_role()   -- base identity/service-role check, used everywhere
--   auth.owns_space(space_id), auth.is_space_member(space_id)      -- app.spaces and anything scoped to a space
--   auth.can_read_note(note_id), auth.can_write_note(note_id)      -- app.notes / note_versions via note_shares
--   auth.can_read_tag(tag_id), auth.is_tag_owner(tag_id)           -- app.tags via app.space_tags
--   auth.is_portfolio_owner(portfolio_id), auth.can_read_portfolio(portfolio_id)  -- app.portfolios' public read path:
--     sub-entity SELECT policies read `(is_portfolio_owner(portfolio_id) OR (is_visible = true AND can_read_portfolio(portfolio_id)))`,
--     so row-level publish gating for portfolios/projects/skills/testimonials/work_experiences IS enforced by RLS,
--     not left entirely to the application -- narrower than 01-career-portfolio.md's privacy note originally implied.
--     Column-level redaction (e.g. hiding work_experiences.base_salary on an otherwise-visible row) is still an
--     application concern; no RLS policy filters by column.
--   auth.can_access_entity(entity_table, entity_id) -- the entities registry
--
-- Example (app.notes):
--   CREATE POLICY app_notes_owner_write_policy ON app.notes
--     USING (auth.is_service_role() OR owner_userid = auth.current_user_id())
--     WITH CHECK (auth.is_service_role() OR owner_userid = auth.current_user_id());
--   CREATE POLICY app_notes_select_policy ON app.notes FOR SELECT
--     USING (auth.is_service_role() OR owner_userid = auth.current_user_id() OR auth.can_read_note(id));
--
-- A generic per-table policy generator (as the original design used) cannot express this: the sharing predicate
-- varies by domain and must be authored per table, not derived solely from an owner_userid/user_id column.
-- This file documents the pattern rather than re-deriving all ~90 tables' exact policy text.

DO $$
DECLARE record_row record; owner_col text;
BEGIN
  FOR record_row IN
    SELECT c.table_schema, c.table_name,
      (SELECT column_name FROM information_schema.columns
        WHERE table_schema = c.table_schema AND table_name = c.table_name AND column_name IN ('owner_userid','user_id')
        ORDER BY (column_name = 'owner_userid') DESC LIMIT 1) AS owner_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'app' AND c.column_name IN ('owner_userid','user_id')
    GROUP BY c.table_schema, c.table_name
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', record_row.table_schema, record_row.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', record_row.table_schema, record_row.table_name);
    EXECUTE format(
      'CREATE POLICY %I_owner_write_policy ON %I.%I USING (auth.is_service_role() OR %I = auth.current_user_id()) WITH CHECK (auth.is_service_role() OR %I = auth.current_user_id())',
      record_row.table_name, record_row.table_schema, record_row.table_name, record_row.owner_col, record_row.owner_col
    );
    -- A table needing wider read access (spaces, notes, tags, portfolios, the entities registry)
    -- additionally gets a hand-authored `<table>_select_policy` using the domain-specific predicate documented above.
  END LOOP;
END $$;

-- app.entities is kept in sync with domain tables by a trigger (app.sync_entity_registry), not maintained manually
-- by application code -- see 00-platform-principles.sql. Its own RLS read policy uses auth.can_access_entity(entity_table, entity_id).

-- ops.audit_logs / ops.search_logs use a distinct service-role-only policy (see 05-identity-ownership-privacy.sql) --
-- they are intentionally excluded from the owner-scoped loop above.
