-- +goose Up
-- +goose StatementBegin
-- Skill proof linking: a skill points at the worklog entries that prove it. The
-- free-text `proof` field stays — it is a human summary — but the structured link
-- lets "show me the work behind this skill" be one query.
--
-- Stored as a jsonb array of entry ids on the skill, the same shape the worklog
-- uses for `tags`/`evidence`. The service validates every id against the owner's
-- own entries; deleting a worklog entry scrubs its id from every skill in the
-- same transaction.
ALTER TABLE app.career_skills
  ADD COLUMN worklog_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT career_skills_worklog_entry_ids_check
    CHECK (jsonb_typeof(worklog_entry_ids) = 'array');

-- Containment (`worklog_entry_ids @> '["<id>"]'`) is both the detail tool's
-- "which skills point here" lookup and the entries tool's `skillId` filter.
CREATE INDEX idx_career_skills_worklog_entry_ids
  ON app.career_skills USING gin (worklog_entry_ids);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS app.idx_career_skills_worklog_entry_ids;
ALTER TABLE app.career_skills DROP COLUMN IF EXISTS worklog_entry_ids;
-- +goose StatementEnd
