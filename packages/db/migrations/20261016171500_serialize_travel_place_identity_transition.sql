-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.guard_travel_place_identity_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = app, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('travel_place_identity_transition:' || NEW.owner_userid, 0)
  );

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
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.guard_travel_place_identity_transition() RETURNS trigger
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
-- +goose StatementEnd
