-- +goose Up
-- +goose StatementBegin
-- The career worklog: a timestamped record of work as it happens. Unlike the rest of the
-- career domain (profile, engagements, projects, skills) this is the mutable layer — what
-- was broken, what was done, what it changed. `raw_note` holds the user's words verbatim
-- and is immutable after insert; everything else may be amended.
CREATE TYPE app.career_worklog_impact_status AS ENUM ('open', 'closed');
CREATE TYPE app.career_worklog_sensitivity AS ENUM ('public_safe', 'internal', 'mixed');

CREATE TABLE app.career_worklog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL,
  project_id uuid,
  occurred_start date NOT NULL DEFAULT current_date,
  occurred_end date,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  area text,
  problem text,
  action text,
  impact text,
  impact_status app.career_worklog_impact_status NOT NULL DEFAULT 'open',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitivity app.career_worklog_sensitivity NOT NULL DEFAULT 'internal',
  public_bullet text,
  known_limits text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_note text NOT NULL,
  -- The engagement is required, so the composite key pins it to the owner: a worklog
  -- entry can never point at another user's engagement. Deleting the engagement deletes
  -- its worklog entries, mirroring app.career_project_engagements.
  CONSTRAINT career_worklog_entries_owner_engagement_fkey
    FOREIGN KEY (owner_userid, engagement_id)
    REFERENCES app.career_engagements (owner_userid, id) ON DELETE CASCADE,
  -- The project is optional, so the link is dropped rather than the entry: a deleted
  -- project must not erase the record of the work that happened under it.
  CONSTRAINT career_worklog_entries_project_fkey
    FOREIGN KEY (project_id) REFERENCES app.career_projects (id) ON DELETE SET NULL,
  CONSTRAINT career_worklog_entries_window_check
    CHECK (occurred_end IS NULL OR occurred_end >= occurred_start),
  CONSTRAINT career_worklog_entries_tags_check
    CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT career_worklog_entries_evidence_check
    CHECK (jsonb_typeof(evidence) = 'array')
);

CREATE UNIQUE INDEX career_worklog_entries_owner_id_key
  ON app.career_worklog_entries (owner_userid, id);
CREATE INDEX idx_career_worklog_entries_owner
  ON app.career_worklog_entries (owner_userid);
CREATE INDEX idx_career_worklog_entries_engagement
  ON app.career_worklog_entries (owner_userid, engagement_id);
CREATE INDEX idx_career_worklog_entries_project
  ON app.career_worklog_entries (owner_userid, project_id);
CREATE INDEX idx_career_worklog_entries_impact_status
  ON app.career_worklog_entries (owner_userid, impact_status);
CREATE INDEX idx_career_worklog_entries_occurred
  ON app.career_worklog_entries (owner_userid, occurred_start DESC, logged_at DESC);
CREATE INDEX idx_career_worklog_entries_tags
  ON app.career_worklog_entries USING gin (tags);

CREATE TRIGGER set_updated_at_career_worklog_entries
  BEFORE UPDATE ON app.career_worklog_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_snake();

ALTER TABLE app.career_worklog_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY career_worklog_entries_owner ON app.career_worklog_entries
  FOR ALL
  USING (auth.is_service_role() OR owner_userid = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userid = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.career_worklog_entries;
DROP TYPE IF EXISTS app.career_worklog_sensitivity;
DROP TYPE IF EXISTS app.career_worklog_impact_status;
-- +goose StatementEnd
