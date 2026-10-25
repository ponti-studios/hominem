-- +goose Up
-- +goose StatementBegin

-- Agents read job boards themselves and push what they found, so the posting facts live on the
-- application row. external_id is the board's own id (Ashby/Greenhouse identifier, Lever UUID):
-- the strongest dedupe signal when the agent can find one. Salary range is in whole currency units.
-- IF NOT EXISTS keeps this idempotent since CI runs goose up twice.
ALTER TABLE app.career_applications
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS posting_text text,
  ADD COLUMN IF NOT EXISTS posted_at date,
  ADD COLUMN IF NOT EXISTS salary_min integer,
  ADD COLUMN IF NOT EXISTS salary_max integer,
  ADD COLUMN IF NOT EXISTS salary_currency text;

-- Dedupe lookups are per user and only look at rows that have a posting URL or board id.
CREATE INDEX IF NOT EXISTS idx_career_apps_owner_posting
  ON app.career_applications (owner_userid)
  WHERE job_posting_url IS NOT NULL OR external_id IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS app.idx_career_apps_owner_posting;
ALTER TABLE app.career_applications
  DROP COLUMN IF EXISTS salary_currency,
  DROP COLUMN IF EXISTS salary_max,
  DROP COLUMN IF EXISTS salary_min,
  DROP COLUMN IF EXISTS posted_at,
  DROP COLUMN IF EXISTS posting_text,
  DROP COLUMN IF EXISTS external_id;

-- +goose StatementEnd
