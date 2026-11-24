-- Persist proactivity evaluation runs so a decision survives the process that
-- produced it: a scheduled pass runs in the worker, the app reads in the HTTP
-- server. One row per (owner, trigger) is the idempotency boundary the engine's
-- journal already assumes; the document keeps evaluations, their evidence
-- citations, and the delivery intents that were recorded rather than sent.

-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.proactivity_runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  trigger_id text NOT NULL CHECK (length(btrim(trigger_id)) > 0),
  processed_at timestamptz NOT NULL,
  run jsonb NOT NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, trigger_id)
);
-- +goose StatementEnd

CREATE INDEX IF NOT EXISTS proactivity_runs_owner_processed_idx
  ON app.proactivity_runs (owner_userId, processed_at DESC);

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.proactivity_runs CASCADE;
-- +goose StatementEnd
