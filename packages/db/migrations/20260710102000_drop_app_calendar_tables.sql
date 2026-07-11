-- +goose Up
-- +goose StatementBegin

DROP TABLE IF EXISTS app.event_occurrences CASCADE;
DROP TABLE IF EXISTS app.calendar_event_sources CASCADE;
DROP TABLE IF EXISTS app.calendars CASCADE;
DROP TABLE IF EXISTS app.event_attendees CASCADE;
DROP TABLE IF EXISTS app.events CASCADE;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE app.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  place_id uuid REFERENCES app.places(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  is_all_day boolean NOT NULL DEFAULT false,
  source text,
  external_id text,
  color text,
  recurrence jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_events_event_type_not_blank CHECK (length(btrim(event_type)) > 0),
  CONSTRAINT app_events_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT app_events_time_order_check CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT app_events_source_not_blank CHECK (source IS NULL OR length(btrim(source)) > 0),
  CONSTRAINT app_events_external_id_not_blank CHECK (external_id IS NULL OR length(btrim(external_id)) > 0)
);

CREATE TABLE app.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
  person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  email text,
  status text NOT NULL DEFAULT 'needs_action',
  role text NOT NULL DEFAULT 'required',
  responded_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_event_attendees_contact_check CHECK (person_id IS NOT NULL OR email IS NOT NULL),
  CONSTRAINT app_event_attendees_email_not_blank CHECK (email IS NULL OR length(btrim(email)) > 0),
  CONSTRAINT app_event_attendees_status_check CHECK (status IN ('needs_action', 'accepted', 'declined', 'tentative')),
  CONSTRAINT app_event_attendees_role_check CHECK (role IN ('required', 'optional', 'organizer'))
);

CREATE TABLE app.calendar_event_sources (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
  calendar_uid text NOT NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_calendar_event_sources_calendar_uid_not_blank CHECK (length(btrim(calendar_uid)) > 0)
);

CREATE TABLE app.event_occurrences (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
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

CREATE TABLE app.calendars (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_id uuid REFERENCES app.import_sources(id) ON DELETE SET NULL,
  external_id text,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  color text,
  timezone text,
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (source_id, external_id)
);

ALTER TABLE app.calendar_event_sources
  ADD COLUMN calendar_id uuid REFERENCES app.calendars(id) ON DELETE SET NULL;

CREATE INDEX app_events_owner_starts_at_idx ON app.events (owner_userId, starts_at);
CREATE INDEX app_events_owner_type_idx ON app.events (owner_userId, event_type);
CREATE INDEX app_events_place_id_idx ON app.events (place_id);
CREATE INDEX app_events_external_id_idx
  ON app.events (owner_userId, source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX app_events_search_idx
  ON app.events USING gin (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))
  );

CREATE INDEX app_event_attendees_event_id_idx ON app.event_attendees (event_id);
CREATE INDEX app_event_attendees_person_id_idx
  ON app.event_attendees (person_id)
  WHERE person_id IS NOT NULL;
CREATE INDEX app_event_attendees_email_idx
  ON app.event_attendees (lower(email))
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX app_event_attendees_event_person_key
  ON app.event_attendees (event_id, person_id)
  WHERE person_id IS NOT NULL;
CREATE UNIQUE INDEX app_event_attendees_event_email_key
  ON app.event_attendees (event_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX app_calendar_event_sources_source_uid_key
  ON app.calendar_event_sources (source_id, calendar_uid);
CREATE INDEX app_calendar_event_sources_event_id_idx ON app.calendar_event_sources (event_id);
CREATE UNIQUE INDEX app_event_occurrences_event_key
  ON app.event_occurrences (event_id, occurrence_key);
CREATE INDEX app_event_occurrences_event_starts_at_idx
  ON app.event_occurrences (event_id, starts_at);
CREATE INDEX app_event_occurrences_starts_at_idx
  ON app.event_occurrences (starts_at)
  WHERE status = 'confirmed';
CREATE INDEX app_calendar_owner_starts_idx ON app.calendars (owner_userId, name);

CREATE TRIGGER app_events_set_updated_at
  BEFORE UPDATE ON app.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_event_attendees_set_updated_at
  BEFORE UPDATE ON app.event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_calendar_event_sources_set_updated_at
  BEFORE UPDATE ON app.calendar_event_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_event_occurrences_set_updated_at
  BEFORE UPDATE ON app.event_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER app_events_sync_entity_registry
  AFTER INSERT OR UPDATE OR DELETE ON app.events
  FOR EACH ROW
  EXECUTE FUNCTION app.sync_entity_registry('owner_userId');

ALTER TABLE app.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.event_attendees FORCE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendar_event_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.event_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.event_occurrences FORCE ROW LEVEL SECURITY;
ALTER TABLE app.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calendars FORCE ROW LEVEL SECURITY;

CREATE POLICY app_events_owner_policy ON app.events
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

CREATE POLICY app_event_attendees_owner_policy ON app.event_attendees
  FOR ALL
  USING (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.events event
      WHERE event.id = event_attendees.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.events event
      WHERE event.id = event_attendees.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  );

CREATE POLICY app_calendar_event_sources_owner_policy ON app.calendar_event_sources
  FOR ALL
  USING (
    auth.is_service_role()
    OR (
      auth.owns_import_source(source_id)
      AND EXISTS (
        SELECT 1 FROM app.events event
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
        SELECT 1 FROM app.events event
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
      SELECT 1 FROM app.events event
      WHERE event.id = event_occurrences.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  )
  WITH CHECK (
    auth.is_service_role()
    OR EXISTS (
      SELECT 1 FROM app.events event
      WHERE event.id = event_occurrences.event_id
        AND event.owner_userId = auth.current_user_id()
    )
  );

CREATE POLICY app_calendars_owner_policy ON app.calendars
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- +goose StatementEnd
