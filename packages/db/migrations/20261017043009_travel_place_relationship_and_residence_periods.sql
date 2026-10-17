-- +goose Up
-- +goose StatementBegin

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app' AND c.relname = 'travel_places' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS app_travel_places_identity_transition_guard ON app.travel_places';
  END IF;
END $$;
DROP TRIGGER IF EXISTS app_places_travel_identity_transition_guard ON app.places;
DROP FUNCTION IF EXISTS app.guard_travel_place_identity_transition();

-- The previous migration chain left travel_places as a projection. Restore it
-- as the approved relationship keyed by the canonical Place UUID.
DROP VIEW app.travel_places;
CREATE TABLE app.travel_places (
  place_id uuid PRIMARY KEY,
  owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  want_to_go boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, owner_userid),
  FOREIGN KEY (place_id, owner_userid)
    REFERENCES app.places(id, owner_userid) ON DELETE CASCADE
);
CREATE INDEX app_travel_places_owner_archive_idx
  ON app.travel_places(owner_userid, archived, place_id);
INSERT INTO app.travel_places (place_id, owner_userid, want_to_go, archived, created_at, updated_at)
SELECT id, owner_userid, want_to_go, archived, createdat, updatedat
FROM app.places
WHERE is_travel_place;

ALTER TABLE app.travel_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.travel_places FORCE ROW LEVEL SECURITY;
CREATE POLICY app_travel_places_owner_policy ON app.travel_places
  FOR ALL USING (auth.is_service_role() OR owner_userid = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userid = auth.current_user_id());
CREATE TRIGGER app_travel_places_set_updated_at
  BEFORE UPDATE ON app.travel_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_travel_places_audit
  AFTER INSERT OR UPDATE OR DELETE ON app.travel_places
  FOR EACH ROW EXECUTE FUNCTION app.log_travel_entity_history();

ALTER TABLE app.places DROP COLUMN is_travel_place;

-- Keep the Residence parent UUID and Place reference. Normalize its grouped
-- period payload into independently addressable period rows.
CREATE TABLE app.place_residence_periods (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  residence_id uuid NOT NULL,
  owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  ongoing boolean NOT NULL DEFAULT false,
  precision text NOT NULL DEFAULT 'day' CHECK (precision IN ('day', 'month', 'year')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (NOT ongoing OR end_date IS NULL),
  UNIQUE (id, owner_userid),
  FOREIGN KEY (residence_id, owner_userid)
    REFERENCES app.place_residences(id, owner_userid) ON DELETE CASCADE
);
CREATE INDEX app_place_residence_periods_residence_dates_idx
  ON app.place_residence_periods(residence_id, start_date, end_date);
CREATE UNIQUE INDEX app_place_residence_periods_one_ongoing_per_owner_idx
  ON app.place_residence_periods(owner_userid) WHERE ongoing;
INSERT INTO app.place_residence_periods (
  residence_id, owner_userid, start_date, end_date, ongoing, precision, note, created_at, updated_at
)
SELECT r.id, r.owner_userid,
       (period ->> 'startDate')::date,
       nullif(period ->> 'endDate', '')::date,
       coalesce((period ->> 'ongoing')::boolean, false),
       coalesce(nullif(period ->> 'precision', ''), 'day'),
       nullif(period ->> 'note', ''), r.created_at, r.updated_at
FROM app.place_residences r
CROSS JOIN LATERAL jsonb_array_elements(r.periods) period;

ALTER TABLE app.place_entity_history
  DROP CONSTRAINT place_entity_history_entity_table_check;
ALTER TABLE app.place_entity_history
  ADD CONSTRAINT place_entity_history_entity_table_check
  CHECK (entity_table IN ('places', 'place_residences', 'place_residence_periods'));
CREATE OR REPLACE FUNCTION app.log_place_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  INSERT INTO app.place_entity_history(owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (
    coalesce(after_row ->> 'owner_userid', before_row ->> 'owner_userid'),
    TG_TABLE_NAME,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid),
    lower(TG_OP), changed, CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
ALTER TABLE app.place_residence_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_residence_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY app_place_residence_periods_owner_policy ON app.place_residence_periods
  FOR ALL USING (auth.is_service_role() OR owner_userid = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userid = auth.current_user_id());
CREATE TRIGGER app_place_residence_periods_set_updated_at
  BEFORE UPDATE ON app.place_residence_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_place_residence_periods_audit
  AFTER INSERT OR UPDATE OR DELETE ON app.place_residence_periods
  FOR EACH ROW EXECUTE FUNCTION app.log_place_entity_history();

ALTER TABLE app.place_residences DROP COLUMN periods;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.place_residences ADD COLUMN periods jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE app.place_residences r
SET periods = coalesce((
  SELECT jsonb_agg(jsonb_build_object(
    'startDate', p.start_date, 'endDate', p.end_date, 'ongoing', p.ongoing,
    'precision', p.precision, 'note', p.note
  ) ORDER BY p.start_date, p.id)
  FROM app.place_residence_periods p WHERE p.residence_id = r.id
), '[]'::jsonb);
DROP TABLE app.place_residence_periods;
ALTER TABLE app.place_entity_history
  DROP CONSTRAINT place_entity_history_entity_table_check;
ALTER TABLE app.place_entity_history
  ADD CONSTRAINT place_entity_history_entity_table_check
  CHECK (entity_table IN ('places', 'place_residences'));
CREATE OR REPLACE FUNCTION app.log_place_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  INSERT INTO app.place_entity_history(owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (
    coalesce(after_row ->> 'owner_userid', before_row ->> 'owner_userid'),
    CASE TG_TABLE_NAME WHEN 'places' THEN 'places' ELSE 'place_residences' END,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid),
    lower(TG_OP), changed, CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER app_travel_places_audit ON app.travel_places;
DROP TRIGGER app_travel_places_set_updated_at ON app.travel_places;
ALTER TABLE app.places ADD COLUMN is_travel_place boolean NOT NULL DEFAULT false;
UPDATE app.places SET is_travel_place = true WHERE id IN (SELECT place_id FROM app.travel_places);
DROP TABLE app.travel_places;
CREATE OR REPLACE VIEW app.travel_places AS
SELECT id, owner_userid, name AS place, country, place_type AS type,
       CASE WHEN want_to_go THEN 'Want to go' ELSE 'Visited' END AS status,
       first_visited, last_visited, notes, archived, is_travel_place,
       createdat AS created_at, updatedat AS updated_at
FROM app.places WHERE is_travel_place;
-- +goose StatementEnd
