-- +goose Up
-- +goose StatementBegin

-- The legacy travel_trips, travel_segments, and travel_trip_attendees tables
-- are intentionally untouched. The v2 stop entity uses travel_journey_segments.
CREATE TABLE app.travel_journeys (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, name text NOT NULL, start_date date, end_date date,
  purpose text CHECK (purpose IS NULL OR purpose IN ('leisure','business','mixed','move')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, legacy_id), UNIQUE (id, owner_userId),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE TABLE app.travel_places (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, place text NOT NULL, country text NOT NULL, type text NOT NULL,
  status text NOT NULL CHECK (status IN ('Visited','Want to go','Lived in')),
  first_visited date, last_visited date, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, legacy_id), UNIQUE (id, owner_userId)
);
CREATE UNIQUE INDEX app_travel_places_owner_name_country_key
  ON app.travel_places(owner_userId, lower(place), lower(country));
CREATE TABLE app.travel_journey_segments (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, journey_id uuid NOT NULL, seq integer NOT NULL CHECK (seq >= 1), place_id uuid NOT NULL,
  arrival_date date, departure_date date, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, legacy_id), UNIQUE (id, owner_userId), UNIQUE (id, journey_id, owner_userId), UNIQUE (journey_id, seq),
  FOREIGN KEY (journey_id, owner_userId) REFERENCES app.travel_journeys(id, owner_userId) ON DELETE CASCADE,
  FOREIGN KEY (place_id, owner_userId) REFERENCES app.travel_places(id, owner_userId),
  CHECK (arrival_date IS NULL OR departure_date IS NULL OR departure_date >= arrival_date)
);
CREATE TABLE app.travel_airports (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, code text NOT NULL, name text NOT NULL, serves_place text NOT NULL,
  city text NOT NULL, country text NOT NULL, notes text, latitude double precision, longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, legacy_id), UNIQUE (id, owner_userId), UNIQUE (owner_userId, code),
  CHECK (code = upper(code))
);
CREATE TABLE app.travel_transport (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, date date, mode text NOT NULL CHECK (mode IN ('air','rail')),
  origin text NOT NULL, destination text NOT NULL, carrier text, number text, booking_ref text,
  dep_segment_id uuid, arr_segment_id uuid, journey_id uuid NOT NULL, legacy_trip text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (journey_id, owner_userId) REFERENCES app.travel_journeys(id, owner_userId) ON DELETE CASCADE,
  FOREIGN KEY (dep_segment_id, journey_id, owner_userId) REFERENCES app.travel_journey_segments(id, journey_id, owner_userId),
  FOREIGN KEY (arr_segment_id, journey_id, owner_userId) REFERENCES app.travel_journey_segments(id, journey_id, owner_userId),
  FOREIGN KEY (origin, owner_userId) REFERENCES app.travel_airports(code, owner_userId),
  FOREIGN KEY (destination, owner_userId) REFERENCES app.travel_airports(code, owner_userId)
);
CREATE INDEX app_travel_transport_legacy_lookup_idx ON app.travel_transport(owner_userId, legacy_id, journey_id, date, origin, destination);
CREATE UNIQUE INDEX app_travel_transport_import_key ON app.travel_transport(owner_userId, legacy_id, journey_id, date, origin, destination) NULLS NOT DISTINCT;
CREATE TABLE app.travel_stays (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, segment_id uuid NOT NULL, journey_id uuid NOT NULL, check_in date, check_out date,
  city text NOT NULL, country text, property text, booking_ref text,
  evidence text NOT NULL CHECK (evidence IN ('email','calendar','thin','want')), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, legacy_id),
  FOREIGN KEY (segment_id, journey_id, owner_userId) REFERENCES app.travel_journey_segments(id, journey_id, owner_userId) ON DELETE CASCADE,
  FOREIGN KEY (journey_id, owner_userId) REFERENCES app.travel_journeys(id, owner_userId) ON DELETE CASCADE,
  CHECK (check_in IS NULL OR check_out IS NULL OR check_out >= check_in)
);
CREATE TABLE app.travel_ideas (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL, idea text NOT NULL, type text NOT NULL CHECK (type IN ('experience','admin','housing')),
  status text NOT NULL CHECK (status IN ('open','done')), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userId, legacy_id), UNIQUE (id, owner_userId)
);
CREATE TABLE app.travel_entity_history (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_table text NOT NULL CHECK (entity_table IN ('travel_journeys','travel_journey_segments','travel_places','travel_transport','travel_stays','travel_airports','travel_ideas')),
  entity_id uuid NOT NULL, operation text NOT NULL CHECK (operation IN ('create','update','delete')),
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb, snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_travel_entity_history_entity_idx ON app.travel_entity_history(owner_userId, entity_table, entity_id, created_at);

CREATE FUNCTION app.log_travel_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  INSERT INTO app.travel_entity_history(owner_userId, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (coalesce(after_row ->> 'owner_userid', before_row ->> 'owner_userid'), TG_TABLE_NAME,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid), lower(TG_OP), changed,
    CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['travel_journeys','travel_journey_segments','travel_places','travel_transport','travel_stays','travel_airports','travel_ideas'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', 'app_'||table_name||'_set_updated_at', table_name);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.log_travel_entity_history()', 'app_'||table_name||'_audit', table_name);
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (auth.is_service_role() OR owner_userId = auth.current_user_id()) WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id())', 'app_'||table_name||'_owner_policy', table_name);
  END LOOP;
END $$;
ALTER TABLE app.travel_entity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.travel_entity_history FORCE ROW LEVEL SECURITY;
CREATE POLICY app_travel_entity_history_owner_policy ON app.travel_entity_history FOR SELECT
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id());
CREATE POLICY app_travel_entity_history_insert_policy ON app.travel_entity_history FOR INSERT
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.travel_entity_history;
DROP TABLE IF EXISTS app.travel_stays;
DROP TABLE IF EXISTS app.travel_transport;
DROP TABLE IF EXISTS app.travel_airports;
DROP TABLE IF EXISTS app.travel_journey_segments;
DROP TABLE IF EXISTS app.travel_places;
DROP TABLE IF EXISTS app.travel_ideas;
DROP TABLE IF EXISTS app.travel_journeys;
-- +goose StatementEnd
