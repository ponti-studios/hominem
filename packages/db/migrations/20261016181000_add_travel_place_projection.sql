-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.places ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW app.travel_places AS
SELECT id, owner_userid, name AS place, country, place_type AS type,
       CASE WHEN want_to_go THEN 'Want to go' ELSE 'Visited' END AS status,
       first_visited, last_visited, notes, archived, is_travel_place,
       createdat AS created_at, updatedat AS updated_at
FROM app.places
WHERE is_travel_place;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP VIEW IF EXISTS app.travel_places;
ALTER TABLE app.places DROP COLUMN IF EXISTS archived;
-- +goose StatementEnd
