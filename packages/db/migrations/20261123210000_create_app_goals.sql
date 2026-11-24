-- Reintroduce app.goals for the proactivity engine. Goals are platform-owned
-- state the engine reads through a goal loader; the table was dropped as
-- unused in 20260728200105 and this shape adds the engine contract
-- (domains, a status check) on top of the pre-cleanup design. key_results
-- stays out until something consumes it.

-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.goals (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'achieved')),
  domains text[] NOT NULL DEFAULT '{}',
  target_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

CREATE INDEX IF NOT EXISTS goals_owner_created_idx ON app.goals (owner_userId, createdAt DESC);

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.goals CASCADE;
-- +goose StatementEnd
