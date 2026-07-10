-- Reconciled Up: events play the "series" role; recurrence is jsonb, not an RRULE string.
CREATE TABLE app.calendars (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL,
  external_id text, name text NOT NULL CHECK (btrim(name) <> ''), color text, timezone text, is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.events (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, place_id uuid,
  event_type text NOT NULL CHECK (btrim(event_type) <> ''), title text NOT NULL CHECK (btrim(title) <> ''), description text,
  starts_at timestamptz NOT NULL, ends_at timestamptz, is_all_day boolean NOT NULL DEFAULT false,
  source text, external_id text, color text, recurrence jsonb NOT NULL DEFAULT '{}', metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE TABLE app.event_occurrences (
  id uuid PRIMARY KEY DEFAULT uuidv7(), event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
  occurrence_key text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz, occurrence_date date, is_all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')), metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_all_day OR occurrence_date IS NOT NULL), CHECK (ends_at IS NULL OR ends_at >= starts_at),
  UNIQUE (event_id, occurrence_key)
);
-- Attendance is tracked per event, not per occurrence: one RSVP covers the whole series.
CREATE TABLE app.event_attendees (
  id uuid PRIMARY KEY DEFAULT uuidv7(), event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
  person_id uuid, email text,
  status text NOT NULL DEFAULT 'needs_action' CHECK (status IN ('needs_action','accepted','declined','tentative')),
  role text NOT NULL DEFAULT 'required' CHECK (role IN ('required','optional','organizer')), responded_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (person_id IS NOT NULL OR email IS NOT NULL)
);
CREATE TABLE app.calendar_event_sources (
  id uuid PRIMARY KEY DEFAULT uuidv7(), source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE, calendar_id uuid REFERENCES app.calendars(id) ON DELETE SET NULL,
  calendar_uid text NOT NULL CHECK (btrim(calendar_uid) <> ''), createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_owner_start ON app.events(owner_userid, starts_at);
CREATE INDEX idx_occurrences_event_start ON app.event_occurrences(event_id, starts_at);
