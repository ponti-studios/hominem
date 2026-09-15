-- +goose Up
-- Calendar is now a device-only EventKit integration. Drop dependants before
-- their event and calendar parents so the migration remains safe to re-run.
DROP TABLE IF EXISTS app.event_occurrences CASCADE;
DROP TABLE IF EXISTS app.calendar_event_sources CASCADE;
DROP TABLE IF EXISTS app.calendar_event_attendees;
DROP TABLE IF EXISTS app.calendar_events;
DROP TABLE IF EXISTS app.calendars;

-- +goose Down
-- This restores the former schema only. Calendar data is intentionally not
-- restored: a verified private database backup is the production recovery path.
CREATE TABLE IF NOT EXISTS app.calendars (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, name)
);
CREATE INDEX IF NOT EXISTS app_calendars_owner_userId_idx ON app.calendars(owner_userId);

CREATE TABLE IF NOT EXISTS app.calendar_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  calendar_id uuid REFERENCES app.calendars(id) ON DELETE SET NULL,
  place_id uuid REFERENCES app.places(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES app.travel_trips(id) ON DELETE SET NULL,
  event_type text,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  is_all_day boolean NOT NULL DEFAULT false,
  status text,
  organizer text,
  recurrence_rule text,
  external_uid text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_row_id text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_calendar_events_owner_starts_idx ON app.calendar_events(owner_userId, starts_at DESC);
CREATE INDEX IF NOT EXISTS app_calendar_events_trip_idx ON app.calendar_events(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_calendar_events_calendar_idx ON app.calendar_events(calendar_id) WHERE calendar_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS app.calendar_event_attendees (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  event_id uuid NOT NULL REFERENCES app.calendar_events(id) ON DELETE CASCADE,
  person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'participant',
  source text,
  createdAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, person_id)
);
CREATE INDEX IF NOT EXISTS app_calendar_event_attendees_event_id_idx ON app.calendar_event_attendees(event_id);
CREATE INDEX IF NOT EXISTS app_calendar_event_attendees_person_id_idx ON app.calendar_event_attendees(person_id) WHERE person_id IS NOT NULL;

ALTER TABLE app.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendars FORCE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_attendees FORCE ROW LEVEL SECURITY;

CREATE POLICY app_calendars_owner_policy ON app.calendars
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

CREATE POLICY app_calendar_events_owner_policy ON app.calendar_events
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

CREATE POLICY app_calendar_event_attendees_owner_policy ON app.calendar_event_attendees
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.calendar_events event
      WHERE event.id = calendar_event_attendees.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.calendar_events event
      WHERE event.id = calendar_event_attendees.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  );

CREATE TABLE IF NOT EXISTS app.calendar_event_sources (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id uuid NOT NULL,
  event_id uuid NOT NULL,
  calendar_uid text NOT NULL,
  calendar_id uuid REFERENCES app.calendars(id) ON DELETE SET NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_calendar_event_sources_calendar_uid_not_blank CHECK (length(btrim(calendar_uid)) > 0)
);

-- +goose StatementBegin
DO $$
BEGIN
  IF to_regclass('app.import_sources') IS NOT NULL THEN
    ALTER TABLE app.calendar_event_sources
      ADD CONSTRAINT app_calendar_event_sources_source_id_fkey
      FOREIGN KEY (source_id) REFERENCES app.import_sources(id) ON DELETE CASCADE;
  END IF;
END $$;
-- +goose StatementEnd

CREATE TABLE IF NOT EXISTS app.event_occurrences (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  event_id uuid NOT NULL,
  occurrence_key text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  occurrence_date date,
  is_all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_event_occurrences_time_order_check CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT app_event_occurrences_all_day_date_check CHECK (NOT is_all_day OR occurrence_date IS NOT NULL),
  CONSTRAINT app_event_occurrences_status_check CHECK (status IN ('confirmed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_calendar_event_sources_source_uid_key
  ON app.calendar_event_sources (source_id, calendar_uid);
CREATE INDEX IF NOT EXISTS app_calendar_event_sources_event_id_idx
  ON app.calendar_event_sources (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS app_event_occurrences_event_key
  ON app.event_occurrences (event_id, occurrence_key);
CREATE INDEX IF NOT EXISTS app_event_occurrences_event_starts_at_idx
  ON app.event_occurrences (event_id, starts_at);
CREATE INDEX IF NOT EXISTS app_event_occurrences_starts_at_idx
  ON app.event_occurrences (starts_at) WHERE status = 'confirmed';

ALTER TABLE app.calendar_event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.event_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.event_occurrences FORCE ROW LEVEL SECURITY;

-- +goose StatementBegin
DO $$
BEGIN
  IF to_regclass('app.events') IS NOT NULL THEN
    ALTER TABLE app.calendar_event_sources
      ADD CONSTRAINT app_calendar_event_sources_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES app.events(id) ON DELETE CASCADE;
    ALTER TABLE app.event_occurrences
      ADD CONSTRAINT app_event_occurrences_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES app.events(id) ON DELETE CASCADE;
  END IF;
END $$;
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
  IF to_regclass('app.events') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY app_calendar_event_sources_owner_policy ON app.calendar_event_sources
        FOR ALL
        USING (auth.is_service_role() OR EXISTS (
          SELECT 1 FROM app.events event
          WHERE event.id = calendar_event_sources.event_id
            AND event.owner_userId = auth.current_user_id()
        ))
        WITH CHECK (auth.is_service_role() OR EXISTS (
          SELECT 1 FROM app.events event
          WHERE event.id = calendar_event_sources.event_id
            AND event.owner_userId = auth.current_user_id()
        ))
    $policy$;
    EXECUTE $policy$
      CREATE POLICY app_event_occurrences_owner_policy ON app.event_occurrences
        FOR ALL
        USING (auth.is_service_role() OR EXISTS (
          SELECT 1 FROM app.events event
          WHERE event.id = event_occurrences.event_id
            AND event.owner_userId = auth.current_user_id()
        ))
        WITH CHECK (auth.is_service_role() OR EXISTS (
          SELECT 1 FROM app.events event
          WHERE event.id = event_occurrences.event_id
            AND event.owner_userId = auth.current_user_id()
        ))
    $policy$;
  END IF;
END $$;
-- +goose StatementEnd
