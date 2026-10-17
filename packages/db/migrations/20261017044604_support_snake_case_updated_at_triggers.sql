-- +goose Up
-- +goose StatementBegin
CREATE FUNCTION app.set_snake_case_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_at', now()));
  RETURN NEW;
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'travel_journeys', 'travel_journey_segments', 'travel_transport', 'travel_stays',
    'travel_airports', 'travel_ideas', 'travel_places', 'place_residences',
    'place_residence_periods'
  ] LOOP
    IF to_regclass('app.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS app_%I_set_updated_at ON app.%I', table_name, table_name);
      EXECUTE format('CREATE TRIGGER app_%I_set_updated_at BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.set_snake_case_updated_at()', table_name, table_name);
    END IF;
  END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'travel_journeys', 'travel_journey_segments', 'travel_transport', 'travel_stays',
    'travel_airports', 'travel_ideas', 'travel_places', 'place_residences',
    'place_residence_periods'
  ] LOOP
    IF to_regclass('app.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS app_%I_set_updated_at ON app.%I', table_name, table_name);
      EXECUTE format('CREATE TRIGGER app_%I_set_updated_at BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_name, table_name);
    END IF;
  END LOOP;
END $$;
DROP FUNCTION app.set_snake_case_updated_at();
-- +goose StatementEnd
