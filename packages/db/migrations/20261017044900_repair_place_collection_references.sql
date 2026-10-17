-- +goose Up
-- +goose StatementBegin

-- Repair collection references left with the dropped travel_places table OID
-- by an already-applied draft of the Place unification migration.
UPDATE app.collection_items canonical
SET note = coalesce(canonical.note, stale.note),
    sort_order = coalesce(canonical.sort_order, stale.sort_order),
    createdat = least(canonical.createdat, stale.createdat)
FROM app.collection_items stale
WHERE NOT EXISTS (
    SELECT 1 FROM pg_class relation WHERE relation.oid = stale.entity_table
  )
  AND canonical.collection_id = stale.collection_id
  AND canonical.entity_table = 'app.places'::regclass
  AND canonical.entity_id = stale.entity_id
  AND EXISTS (
    SELECT 1 FROM app.places place
    WHERE place.id = stale.entity_id AND place.owner_userid = stale.owner_userid
  );

DELETE FROM app.collection_items stale
WHERE NOT EXISTS (
    SELECT 1 FROM pg_class relation WHERE relation.oid = stale.entity_table
  )
  AND EXISTS (
    SELECT 1 FROM app.places place
    WHERE place.id = stale.entity_id AND place.owner_userid = stale.owner_userid
  )
  AND EXISTS (
    SELECT 1 FROM app.collection_items canonical
    WHERE canonical.collection_id = stale.collection_id
      AND canonical.entity_table = 'app.places'::regclass
      AND canonical.entity_id = stale.entity_id
  );

UPDATE app.collection_items item
SET entity_table = 'app.places'::regclass
WHERE NOT EXISTS (
  SELECT 1 FROM pg_class relation WHERE relation.oid = item.entity_table
)
  AND EXISTS (
    SELECT 1 FROM app.places place
    WHERE place.id = item.entity_id AND place.owner_userid = item.owner_userid
  );

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  RAISE EXCEPTION 'repointing collection references is irreversible';
END $$;
-- +goose StatementEnd
