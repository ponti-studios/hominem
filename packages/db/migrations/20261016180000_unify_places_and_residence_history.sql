-- +goose Up
-- +goose StatementBegin

ALTER TABLE app.places
  ADD COLUMN notes text,
  ADD COLUMN first_visited date,
  ADD COLUMN last_visited date,
  ADD COLUMN want_to_go boolean NOT NULL DEFAULT false,
  ADD COLUMN is_travel_place boolean NOT NULL DEFAULT false,
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

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
    GROUP BY t.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'place_identity_ambiguous: multiple app.places rows match a travel place';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app.place_visits v
    JOIN app.places p ON p.id = v.place_id
    WHERE v.owner_userid <> p.owner_userid
  ) THEN
    RAISE EXCEPTION 'place_owner_mismatch: place_visits contains a cross-owner place reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app.travel_segments s
    JOIN app.places p ON p.id = s.origin_place_id OR p.id = s.destination_place_id
    WHERE s.owner_userid <> p.owner_userid
  ) THEN
    RAISE EXCEPTION 'place_owner_mismatch: travel_segments contains a cross-owner place reference';
  END IF;
END $$;

CREATE TEMP TABLE place_identity_migration_map ON COMMIT DROP AS
SELECT p.id AS old_place_id, p.owner_userid, t.id AS travel_place_id
FROM app.travel_places t
JOIN app.places p
  ON p.owner_userid = t.owner_userid
 AND lower(btrim(p.name)) = lower(btrim(t.place))
 AND lower(btrim(coalesce(p.country, ''))) = lower(btrim(t.country))
 AND p.place_type IN ('city', 'country')
 AND p.id <> t.id;

INSERT INTO app.places (
  id, owner_userid, name, place_type, city, country, country_code,
  latitude, longitude, notes, first_visited, last_visited, want_to_go,
  is_travel_place, createdat, updatedat
)
SELECT
  t.id,
  t.owner_userid,
  t.place,
  t.type,
  CASE WHEN lower(t.type) = 'city' THEN t.place END,
  t.country,
  NULL,
  NULL,
  NULL,
  t.notes,
  t.first_visited,
  t.last_visited,
  t.status = 'Want to go',
  true,
  t.created_at,
  t.updated_at
FROM app.travel_places t
LEFT JOIN place_identity_migration_map m ON m.travel_place_id = t.id
LEFT JOIN app.places existing ON existing.id = t.id
WHERE existing.id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE app.places p
SET place_type = coalesce(p.place_type, t.type),
    city = coalesce(p.city, CASE WHEN lower(t.type) = 'city' THEN t.place END),
    country = coalesce(p.country, t.country),
    notes = coalesce(p.notes, t.notes),
    first_visited = coalesce(p.first_visited, t.first_visited),
    last_visited = coalesce(p.last_visited, t.last_visited),
    want_to_go = t.status = 'Want to go',
    is_travel_place = true
FROM app.travel_places t
WHERE p.id = t.id AND p.owner_userid = t.owner_userid;

UPDATE app.places canonical
SET place_type = coalesce(canonical.place_type, duplicate.place_type),
    formatted_address = coalesce(canonical.formatted_address, duplicate.formatted_address),
    city = coalesce(canonical.city, duplicate.city),
    state = coalesce(canonical.state, duplicate.state),
    postal_code = coalesce(canonical.postal_code, duplicate.postal_code),
    country = coalesce(canonical.country, duplicate.country),
    country_code = coalesce(canonical.country_code, duplicate.country_code),
    latitude = coalesce(canonical.latitude, duplicate.latitude),
    longitude = coalesce(canonical.longitude, duplicate.longitude),
    url = coalesce(canonical.url, duplicate.url),
    geocoded_at = coalesce(canonical.geocoded_at, duplicate.geocoded_at),
    metadata = canonical.metadata || duplicate.metadata,
    notes = coalesce(canonical.notes, duplicate.notes)
FROM place_identity_migration_map m
JOIN app.places duplicate ON duplicate.id = m.old_place_id
WHERE canonical.id = m.travel_place_id AND canonical.owner_userid = m.owner_userid;

UPDATE app.place_visits v
SET place_id = m.travel_place_id
FROM place_identity_migration_map m
WHERE v.place_id = m.old_place_id AND v.owner_userid = m.owner_userid;

UPDATE app.travel_segments s
SET origin_place_id = coalesce(
      (SELECT travel_place_id FROM place_identity_migration_map WHERE old_place_id = s.origin_place_id),
      s.origin_place_id
    ),
    destination_place_id = coalesce(
      (SELECT travel_place_id FROM place_identity_migration_map WHERE old_place_id = s.destination_place_id),
      s.destination_place_id
    )
WHERE EXISTS (SELECT 1 FROM place_identity_migration_map WHERE old_place_id = s.origin_place_id)
   OR EXISTS (SELECT 1 FROM place_identity_migration_map WHERE old_place_id = s.destination_place_id);

DELETE FROM app.tag_assignments duplicate
USING place_identity_migration_map m, app.tag_assignments canonical
WHERE duplicate.entity_table = 'app.places'::regclass
  AND duplicate.entity_id = m.old_place_id
  AND canonical.entity_table = duplicate.entity_table
  AND canonical.entity_id = m.travel_place_id
  AND canonical.tag_id = duplicate.tag_id
  AND canonical.removed_at IS NULL
  AND duplicate.removed_at IS NULL;

UPDATE app.tag_assignments assignment
SET entity_id = m.travel_place_id
FROM place_identity_migration_map m
WHERE assignment.entity_table = 'app.places'::regclass
  AND assignment.entity_id = m.old_place_id;

DELETE FROM app.tag_assignments duplicate
USING app.travel_places old_place, app.tag_assignments canonical
WHERE duplicate.entity_table = 'app.travel_places'::regclass
  AND duplicate.entity_id = old_place.id
  AND canonical.entity_table = 'app.places'::regclass
  AND canonical.entity_id = old_place.id
  AND canonical.tag_id = duplicate.tag_id
  AND canonical.removed_at IS NULL
  AND duplicate.removed_at IS NULL;

UPDATE app.tag_assignments assignment
SET entity_table = 'app.places'::regclass
WHERE assignment.entity_table = 'app.travel_places'::regclass;

DO $$
BEGIN
  IF to_regclass('app.entities') IS NOT NULL THEN
    UPDATE app.entities entity
    SET entity_id = map.travel_place_id
    FROM place_identity_migration_map map
    WHERE entity.entity_table = 'app.places'::regclass
      AND entity.entity_id = map.old_place_id
      AND NOT EXISTS (
        SELECT 1 FROM app.entities existing
        WHERE existing.entity_table = entity.entity_table
          AND existing.entity_id = map.travel_place_id
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('app.entities') IS NOT NULL THEN
    UPDATE app.entities SET entity_table = 'app.places'::regclass
    WHERE entity_table = 'app.travel_places'::regclass;
  END IF;
END $$;

DELETE FROM app.places duplicate
USING place_identity_migration_map map
WHERE duplicate.id = map.old_place_id;

ALTER TABLE app.places ADD CONSTRAINT places_id_owner_userid_key UNIQUE (id, owner_userid);
ALTER TABLE app.travel_journey_segments
  DROP CONSTRAINT travel_journey_segments_place_id_owner_userid_fkey;
ALTER TABLE app.travel_journey_segments
  ADD CONSTRAINT travel_journey_segments_place_id_owner_userid_fkey
  FOREIGN KEY (place_id, owner_userid)
  REFERENCES app.places(id, owner_userid);
CREATE UNIQUE INDEX app_places_travel_identity_key
  ON app.places(owner_userid, lower(btrim(name)), lower(btrim(coalesce(country, ''))))
  WHERE is_travel_place;
DROP TRIGGER app_travel_residences_audit ON app.travel_residences;
DROP TRIGGER app_travel_residences_set_updated_at ON app.travel_residences;
ALTER TABLE app.travel_residences RENAME TO place_residences;
ALTER TABLE app.place_residences
  DROP CONSTRAINT travel_residences_place_id_owner_userid_fkey;
ALTER TABLE app.place_residences
  ADD CONSTRAINT place_residences_place_id_owner_userid_fkey
  FOREIGN KEY (place_id, owner_userid)
  REFERENCES app.places(id, owner_userid) ON DELETE RESTRICT;
ALTER TABLE app.place_residences RENAME CONSTRAINT travel_residences_owner_place_key TO place_residences_owner_place_key;
ALTER TABLE app.place_residences RENAME CONSTRAINT travel_residences_pkey TO place_residences_pkey;
ALTER POLICY app_travel_residences_owner_policy ON app.place_residences
  RENAME TO app_place_residences_owner_policy;
CREATE TRIGGER app_place_residences_set_updated_at
  BEFORE UPDATE ON app.place_residences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE app.place_entity_history (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_table text NOT NULL CHECK (entity_table IN ('places', 'place_residences')),
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_place_entity_history_entity_idx
  ON app.place_entity_history(owner_userid, entity_table, entity_id, created_at);

CREATE FUNCTION app.log_place_entity_history() RETURNS trigger
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
    lower(TG_OP), changed,
    CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER app_place_residences_audit
  AFTER INSERT OR UPDATE OR DELETE ON app.place_residences
  FOR EACH ROW EXECUTE FUNCTION app.log_place_entity_history();
CREATE TRIGGER app_places_audit
  AFTER INSERT OR UPDATE OR DELETE ON app.places
  FOR EACH ROW EXECUTE FUNCTION app.log_place_entity_history();

ALTER TABLE app.place_entity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_entity_history FORCE ROW LEVEL SECURITY;
CREATE POLICY app_place_entity_history_owner_policy ON app.place_entity_history
  FOR SELECT USING (auth.is_service_role() OR owner_userid = auth.current_user_id());
CREATE POLICY app_place_entity_history_insert_policy ON app.place_entity_history
  FOR INSERT WITH CHECK (auth.is_service_role() OR owner_userid = auth.current_user_id());

ALTER TABLE app.travel_entity_history
  DROP CONSTRAINT travel_entity_history_entity_table_check;
ALTER TABLE app.travel_entity_history
  ADD CONSTRAINT travel_entity_history_entity_table_check
  CHECK (entity_table IN (
    'travel_journeys', 'travel_journey_segments', 'travel_transport',
    'travel_stays', 'travel_airports', 'travel_ideas', 'travel_places',
    'travel_residences'
  ));

DROP TABLE app.travel_places;
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
DO $$
BEGIN
  RAISE EXCEPTION 'unify_places_and_residence_history is irreversible; restore from backup before rollback';
END $$;
-- +goose StatementEnd
