-- Up: observations and activities only. sleep_sessions/nutrition_entries/medications/supplement_regimens
-- and a dedicated health_sources table are NOT implemented -- unbuilt scope, not renamed. `source` is free text.
CREATE TABLE app.health_observations (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL, observation_type text NOT NULL CHECK (btrim(observation_type) <> ''), value numeric, unit text, source text,
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.health_activities (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (btrim(activity_type) <> ''), starts_at timestamptz NOT NULL, ends_at timestamptz, source text,
  metrics jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX idx_health_observations_owner_time ON app.health_observations(owner_userid, observed_at DESC);
