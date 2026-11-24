-- The proactivity action ledger: what the engine offered, what the person
-- approved, and how to undo it. An action belongs to the run and goal that
-- produced it, so a finding can render "Done · Undo" after a restart and a
-- repeat tap cannot create a second task or pause a goal twice.

-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.proactivity_actions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  trigger_id text NOT NULL CHECK (length(btrim(trigger_id)) > 0),
  goal_id uuid NOT NULL REFERENCES app.goals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('task.create', 'goal.pause', 'finding.snooze')),
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'undone')),
  payload jsonb NOT NULL,
  inverse jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- One open action per finding and kind; an undone action frees the slot.
CREATE UNIQUE INDEX IF NOT EXISTS proactivity_actions_open_idx
  ON app.proactivity_actions (owner_userId, trigger_id, goal_id, kind)
  WHERE status = 'applied';

CREATE INDEX IF NOT EXISTS proactivity_actions_trigger_idx
  ON app.proactivity_actions (owner_userId, trigger_id, applied_at DESC);

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.proactivity_actions CASCADE;
-- +goose StatementEnd
