-- +goose Up
-- Calendar is now a device-only EventKit integration. Drop dependants before
-- their event and calendar parents so the migration remains safe to re-run.
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
