-- +goose Up
ALTER TABLE app.places
  DROP COLUMN want_to_go,
  DROP COLUMN archived;

-- +goose Down
ALTER TABLE app.places
  ADD COLUMN want_to_go boolean NOT NULL DEFAULT false,
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

UPDATE app.places p
SET want_to_go = t.want_to_go,
    archived = t.archived
FROM app.travel_places t
WHERE t.place_id = p.id AND t.owner_userid = p.owner_userid;
