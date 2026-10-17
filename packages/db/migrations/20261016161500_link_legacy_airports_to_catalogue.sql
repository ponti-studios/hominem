-- +goose Up
ALTER TABLE app.travel_airports
  ADD COLUMN catalogue_id uuid REFERENCES app.airport_catalogue(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE app.travel_airports DROP COLUMN catalogue_id;
