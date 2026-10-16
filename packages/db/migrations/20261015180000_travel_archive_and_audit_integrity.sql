-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.travel_journeys ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE app.travel_places ADD COLUMN archived boolean NOT NULL DEFAULT false;

CREATE FUNCTION app.prevent_travel_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF position(',' || OLD.owner_userId || ',' IN ',' || current_setting('app.travel_owner_deleting', true) || ',') > 0
    OR NOT EXISTS (SELECT 1 FROM public."user" WHERE id = OLD.owner_userId) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'travel entity history is append-only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER app_travel_entity_history_append_only
  BEFORE UPDATE OR DELETE ON app.travel_entity_history
  FOR EACH ROW EXECUTE FUNCTION app.prevent_travel_history_mutation();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS app_travel_entity_history_append_only ON app.travel_entity_history;
DROP FUNCTION IF EXISTS app.prevent_travel_history_mutation();
ALTER TABLE app.travel_places DROP COLUMN archived;
ALTER TABLE app.travel_journeys DROP COLUMN archived;
-- +goose StatementEnd
