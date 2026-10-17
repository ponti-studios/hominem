-- +goose Up
-- +goose StatementBegin

-- 20261016180000 originally had a name/country based merge. Freeze any new
-- candidate identities while that migration sequence is running, and fail if
-- the deployed data now contains a candidate the old migration could merge.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app.travel_places t
    JOIN app.places p
      ON p.owner_userid = t.owner_userid
     AND lower(btrim(p.name)) = lower(btrim(t.place))
     AND lower(btrim(coalesce(p.country, ''))) = lower(btrim(t.country))
     AND p.place_type IN ('city', 'country')
     AND p.id <> t.id
  ) THEN
    RAISE EXCEPTION 'travel_place_identity_candidate: place identity migration requires explicit reconciliation';
  END IF;
END $$;

CREATE FUNCTION app.guard_travel_place_identity_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = app, public AS $$
BEGIN
  IF TG_TABLE_NAME = 'travel_places' THEN
    IF EXISTS (
      SELECT 1 FROM app.places p
      WHERE p.owner_userid = NEW.owner_userid
        AND lower(btrim(p.name)) = lower(btrim(NEW.place))
        AND lower(btrim(coalesce(p.country, ''))) = lower(btrim(NEW.country))
        AND p.place_type IN ('city', 'country')
        AND p.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'travel_place_identity_transition_locked';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM app.travel_places t
      WHERE t.owner_userid = NEW.owner_userid
        AND lower(btrim(t.place)) = lower(btrim(NEW.name))
        AND lower(btrim(t.country)) = lower(btrim(coalesce(NEW.country, '')))
        AND NEW.place_type IN ('city', 'country')
        AND t.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'travel_place_identity_transition_locked';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER app_places_travel_identity_transition_guard
  BEFORE INSERT OR UPDATE OF owner_userid, name, country, place_type ON app.places
  FOR EACH ROW EXECUTE FUNCTION app.guard_travel_place_identity_transition();
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app' AND c.relname = 'travel_places' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'CREATE TRIGGER app_travel_places_identity_transition_guard
      BEFORE INSERT OR UPDATE OF owner_userid, place, country ON app.travel_places
      FOR EACH ROW EXECUTE FUNCTION app.guard_travel_place_identity_transition()';
  END IF;
END $$;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS app_travel_places_identity_transition_guard ON app.travel_places;
DROP TRIGGER IF EXISTS app_places_travel_identity_transition_guard ON app.places;
DROP FUNCTION IF EXISTS app.guard_travel_place_identity_transition();
-- +goose StatementEnd
