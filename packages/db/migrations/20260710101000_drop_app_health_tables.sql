-- +goose Up
-- +goose StatementBegin

DROP TABLE IF EXISTS app.health_activities;
DROP TABLE IF EXISTS app.health_observations;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE app.health_observations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  observation_type text NOT NULL CHECK (length(btrim(observation_type)) > 0),
  value numeric,
  unit text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.health_activities (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (length(btrim(activity_type)) > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  source text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX app_health_observations_owner_observed_idx
  ON app.health_observations (owner_userId, observed_at DESC);

CREATE INDEX app_health_activities_owner_started_idx
  ON app.health_activities (owner_userId, starts_at DESC);

ALTER TABLE app.health_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.health_observations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.health_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.health_activities FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['health_observations', 'health_activities'] LOOP
    EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (auth.is_service_role() OR owner_userId = auth.current_user_id()) WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id())', 'app_' || table_name || '_owner_policy', table_name);
  END LOOP;
END $$;

-- +goose StatementEnd