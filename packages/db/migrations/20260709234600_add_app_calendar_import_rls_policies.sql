-- +goose Up
-- +goose StatementBegin

ALTER TABLE app.calendar_event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.event_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.event_occurrences FORCE ROW LEVEL SECURITY;

CREATE POLICY app_calendar_event_sources_owner_policy ON app.calendar_event_sources
  FOR ALL
  USING (
    auth.is_service_role()
    OR (
      auth.owns_import_source(source_id)
      AND EXISTS (
        SELECT 1
        FROM app.events event
        WHERE event.id = calendar_event_sources.event_id
          AND event.owner_userId = auth.current_user_id()
      )
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR (
      auth.owns_import_source(source_id)
      AND EXISTS (
        SELECT 1
        FROM app.events event
        WHERE event.id = calendar_event_sources.event_id
          AND event.owner_userId = auth.current_user_id()
      )
    )
  );

CREATE POLICY app_event_occurrences_owner_policy ON app.event_occurrences
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.events event
      WHERE event.id = event_occurrences.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM app.events event
      WHERE event.id = event_occurrences.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  );

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP POLICY IF EXISTS app_event_occurrences_owner_policy ON app.event_occurrences;
DROP POLICY IF EXISTS app_calendar_event_sources_owner_policy ON app.calendar_event_sources;

ALTER TABLE app.event_occurrences DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_sources DISABLE ROW LEVEL SECURITY;

-- +goose StatementEnd
