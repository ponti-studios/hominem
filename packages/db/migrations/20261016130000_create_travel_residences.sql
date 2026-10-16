-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.travel_residences (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  legacy_id text NOT NULL,
  place_id uuid NOT NULL,
  periods jsonb NOT NULL,
  source_first_visited date,
  source_last_visited date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_userid, legacy_id),
  UNIQUE (id, owner_userid),
  FOREIGN KEY (place_id, owner_userid)
    REFERENCES app.travel_places(id, owner_userid) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(periods) = 'array' AND jsonb_array_length(periods) >= 1)
);

ALTER TABLE app.travel_entity_history
  DROP CONSTRAINT travel_entity_history_entity_table_check;
ALTER TABLE app.travel_entity_history
  ADD CONSTRAINT travel_entity_history_entity_table_check
  CHECK (entity_table IN (
    'travel_journeys', 'travel_journey_segments', 'travel_places',
    'travel_transport', 'travel_stays', 'travel_airports', 'travel_ideas',
    'travel_residences'
  ));

CREATE TRIGGER app_travel_residences_set_updated_at
  BEFORE UPDATE ON app.travel_residences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_travel_residences_audit
  AFTER INSERT OR UPDATE OR DELETE ON app.travel_residences
  FOR EACH ROW EXECUTE FUNCTION app.log_travel_entity_history();

ALTER TABLE app.travel_residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.travel_residences FORCE ROW LEVEL SECURITY;
CREATE POLICY app_travel_residences_owner_policy ON app.travel_residences
  FOR ALL USING (auth.is_service_role() OR owner_userid = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userid = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.travel_residences;
ALTER TABLE app.travel_entity_history
  DROP CONSTRAINT travel_entity_history_entity_table_check;
ALTER TABLE app.travel_entity_history
  ADD CONSTRAINT travel_entity_history_entity_table_check
  CHECK (entity_table IN (
    'travel_journeys', 'travel_journey_segments', 'travel_places',
    'travel_transport', 'travel_stays', 'travel_airports', 'travel_ideas'
  ));
-- +goose StatementEnd
