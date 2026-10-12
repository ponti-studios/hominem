-- +goose Up
-- +goose StatementBegin

-- Append-only audit log for possessions (plan §5: PossessionEvent). Every possession write
-- records one row; history is read newest-first. Container history has no consumer, so only
-- possessions are logged (YAGNI). Hard deletes cascade: a deleted row's events go with it,
-- so DELETE emits nothing persistent.
CREATE TABLE IF NOT EXISTS app.possession_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  possession_id uuid NOT NULL REFERENCES app.possessions(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  kind text NOT NULL CHECK (kind IN
    ('created', 'updated', 'moved', 'status_changed', 'archived', 'deleted')),
  diff jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_app_possession_events_lookup
  ON app.possession_events(possession_id, at DESC);
ALTER TABLE app.possession_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.possession_events FORCE ROW LEVEL SECURITY;
CREATE POLICY app_possession_events_owner_policy ON app.possession_events
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS app.possession_events;

-- +goose StatementEnd
