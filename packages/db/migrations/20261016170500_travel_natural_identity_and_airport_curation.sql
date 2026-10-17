-- +goose Up
-- +goose StatementBegin
DO $travel_migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'travel_journeys' AND column_name = 'legacy_id'
  ) THEN
    EXECUTE $travel_stmt_0_$
    -- The sheet identifiers are kept in the operator's frozen mapping snapshot,
    -- not in the live travel domain. Existing UUIDs and relationships stay intact.
    DROP INDEX IF EXISTS app_travel_transport_legacy_lookup_idx;
    $travel_stmt_0_$;
    EXECUTE $travel_stmt_1_$
    DROP INDEX IF EXISTS app_travel_transport_import_key;
    $travel_stmt_1_$;
    EXECUTE $travel_stmt_2_$
    ALTER TABLE app.travel_transport
      DROP CONSTRAINT IF EXISTS travel_transport_origin_owner_userid_fkey,
      DROP CONSTRAINT IF EXISTS travel_transport_destination_owner_userid_fkey;
    $travel_stmt_2_$;
    EXECUTE $travel_stmt_3_$
    ALTER TABLE app.travel_journeys DROP COLUMN legacy_id CASCADE;
    $travel_stmt_3_$;
    EXECUTE $travel_stmt_4_$
    ALTER TABLE app.travel_places DROP COLUMN legacy_id CASCADE;
    $travel_stmt_4_$;
    EXECUTE $travel_stmt_5_$
    ALTER TABLE app.travel_journey_segments DROP COLUMN legacy_id CASCADE;
    $travel_stmt_5_$;
    EXECUTE $travel_stmt_6_$
    ALTER TABLE app.travel_transport DROP COLUMN legacy_id CASCADE;
    $travel_stmt_6_$;
    EXECUTE $travel_stmt_7_$
    ALTER TABLE app.travel_stays DROP COLUMN legacy_id CASCADE;
    $travel_stmt_7_$;
    EXECUTE $travel_stmt_8_$
    ALTER TABLE app.travel_ideas DROP COLUMN legacy_id CASCADE;
    $travel_stmt_8_$;
    EXECUTE $travel_stmt_9_$
    ALTER TABLE app.travel_residences
      DROP COLUMN legacy_id CASCADE,
      DROP COLUMN source_first_visited,
      DROP COLUMN source_last_visited;
    $travel_stmt_9_$;
    EXECUTE $travel_stmt_10_$
    ALTER TABLE app.travel_residences
      ADD CONSTRAINT travel_residences_owner_place_key UNIQUE (owner_userid, place_id);
    $travel_stmt_10_$;
    EXECUTE $travel_stmt_11_$
    ALTER TABLE app.travel_airports
      DROP COLUMN legacy_id CASCADE;
    $travel_stmt_11_$;
    EXECUTE $travel_stmt_12_$
    -- Airport reference rows are operator-managed. Codes intentionally are not
    -- unique because source datasets can contain reused or duplicate IATA codes.
    ALTER TABLE app.airport_catalogue RENAME TO travel_airport_reference;
    $travel_stmt_12_$;
    EXECUTE $travel_stmt_13_$
    ALTER TABLE app.travel_airport_reference RENAME COLUMN iata_code TO code;
    $travel_stmt_13_$;
    EXECUTE $travel_stmt_14_$
    ALTER TABLE app.travel_airport_reference RENAME COLUMN municipality TO city;
    $travel_stmt_14_$;
    EXECUTE $travel_stmt_15_$
    ALTER TABLE app.travel_airport_reference RENAME COLUMN iso_country TO country;
    $travel_stmt_15_$;
    EXECUTE $travel_stmt_16_$
    ALTER TABLE app.travel_airport_reference RENAME COLUMN airport_type TO type;
    $travel_stmt_16_$;
    EXECUTE $travel_stmt_17_$
    ALTER TABLE app.travel_airport_reference
      DROP COLUMN IF EXISTS icao_code,
      DROP COLUMN IF EXISTS gps_code,
      DROP COLUMN IF EXISTS local_code,
      DROP COLUMN IF EXISTS ident,
      ADD COLUMN IF NOT EXISTS missing_from_source boolean NOT NULL DEFAULT false;
    $travel_stmt_17_$;
    EXECUTE $travel_stmt_18_$
    ALTER TABLE app.travel_transport
      ADD COLUMN origin_reference_id uuid REFERENCES app.travel_airport_reference(id) ON DELETE SET NULL,
      ADD COLUMN destination_reference_id uuid REFERENCES app.travel_airport_reference(id) ON DELETE SET NULL;
    $travel_stmt_18_$;
    EXECUTE $travel_stmt_19_$
    UPDATE app.travel_transport SET origin_reference_id=origin_airport_id,
      destination_reference_id=destination_airport_id;
    $travel_stmt_19_$;
    EXECUTE $travel_stmt_20_$
    ALTER TABLE app.travel_transport
      DROP CONSTRAINT IF EXISTS travel_transport_origin_airport_id_fkey,
      DROP CONSTRAINT IF EXISTS travel_transport_destination_airport_id_fkey,
      DROP COLUMN IF EXISTS origin_airport_id,
      DROP COLUMN IF EXISTS destination_airport_id;
    $travel_stmt_20_$;
    EXECUTE $travel_stmt_21_$
    DROP INDEX IF EXISTS airport_catalogue_iata_idx;
    $travel_stmt_21_$;
    EXECUTE $travel_stmt_22_$
    DROP INDEX IF EXISTS airport_catalogue_icao_idx;
    $travel_stmt_22_$;
    EXECUTE $travel_stmt_23_$
    DROP INDEX IF EXISTS airport_catalogue_gps_idx;
    $travel_stmt_23_$;
    EXECUTE $travel_stmt_24_$
    DROP INDEX IF EXISTS airport_catalogue_local_idx;
    $travel_stmt_24_$;
    EXECUTE $travel_stmt_25_$
    DROP INDEX IF EXISTS airport_catalogue_name_idx;
    $travel_stmt_25_$;
    EXECUTE $travel_stmt_26_$
    DROP INDEX IF EXISTS airport_catalogue_municipality_idx;
    $travel_stmt_26_$;
    EXECUTE $travel_stmt_27_$
    DROP INDEX IF EXISTS app.travel_airport_reference_code_idx;
    $travel_stmt_27_$;
    EXECUTE $travel_stmt_28_$
    DROP INDEX IF EXISTS app.travel_airport_reference_name_idx;
    $travel_stmt_28_$;
    EXECUTE $travel_stmt_29_$
    DROP INDEX IF EXISTS app.travel_airport_reference_city_idx;
    $travel_stmt_29_$;
    EXECUTE $travel_stmt_30_$
    CREATE INDEX travel_airport_reference_code_idx ON app.travel_airport_reference (upper(code)) WHERE code IS NOT NULL;
    $travel_stmt_30_$;
    EXECUTE $travel_stmt_31_$
    CREATE INDEX travel_airport_reference_name_idx ON app.travel_airport_reference USING gin (name gin_trgm_ops);
    $travel_stmt_31_$;
    EXECUTE $travel_stmt_32_$
    CREATE INDEX travel_airport_reference_city_idx ON app.travel_airport_reference USING gin (city gin_trgm_ops);
    $travel_stmt_32_$;
    EXECUTE $travel_stmt_33_$
    ALTER TABLE app.airport_catalogue_sync_runs RENAME TO travel_airport_reference_refresh_log;
    $travel_stmt_33_$;
    EXECUTE $travel_stmt_34_$
    ALTER TABLE app.travel_airport_reference_refresh_log
      ADD COLUMN source_name text NOT NULL DEFAULT 'operator',
      ADD COLUMN source_url text,
      ADD COLUMN retrieved_at timestamptz,
      ADD COLUMN row_count integer NOT NULL DEFAULT 0,
      ADD COLUMN unchanged_count integer NOT NULL DEFAULT 0,
      ADD COLUMN drift_flagged_count integer NOT NULL DEFAULT 0,
      ADD COLUMN missing_flagged_count integer NOT NULL DEFAULT 0,
      ADD COLUMN drift_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN missing_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
    $travel_stmt_34_$;
    EXECUTE $travel_stmt_35_$
    CREATE FUNCTION app.protect_travel_airport_reference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
    DECLARE
      pinned boolean;
      entries jsonb := '[]'::jsonb;
      field_name text;
      old_value jsonb;
      new_value jsonb;
      active_run uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        UPDATE app.travel_airport_reference
          SET missing_from_source = true, updated_at = now()
          WHERE id = OLD.id;
        RETURN NULL;
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM app.travel_airports c WHERE upper(c.code) = upper(OLD.code)
        UNION ALL
        SELECT 1 FROM app.travel_transport t
          WHERE upper(t.origin) = upper(OLD.code) OR upper(t.destination) = upper(OLD.code)
            OR t.origin_reference_id = OLD.id OR t.destination_reference_id = OLD.id
      ) INTO pinned;
      IF pinned THEN
        FOREACH field_name IN ARRAY ARRAY['code','name','city','country','latitude','longitude'] LOOP
          old_value := to_jsonb(OLD) -> field_name;
          new_value := to_jsonb(NEW) -> field_name;
          IF old_value IS DISTINCT FROM new_value THEN
            entries := entries || jsonb_build_array(jsonb_build_object(
              'code', OLD.code, 'sourceId', OLD.source_id, 'field', field_name,
              'storedValue', old_value, 'datasetValue', new_value
            ));
            NEW := jsonb_populate_record(NEW, jsonb_build_object(field_name, old_value));
          END IF;
        END LOOP;
      END IF;
      IF jsonb_array_length(entries) > 0 THEN
        SELECT id INTO active_run FROM app.travel_airport_reference_refresh_log
          WHERE status = 'running' ORDER BY started_at DESC LIMIT 1;
        IF active_run IS NULL THEN
          INSERT INTO app.travel_airport_reference_refresh_log
            (source_version, source_checksum, source_name, status, drift_entries, drift_flagged_count)
          VALUES ('operator', 'operator', 'operator', 'succeeded', entries, jsonb_array_length(entries));
        ELSE
          UPDATE app.travel_airport_reference_refresh_log
            SET drift_entries = drift_entries || entries,
                drift_flagged_count = drift_flagged_count + jsonb_array_length(entries)
            WHERE id = active_run;
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    $travel_stmt_35_$;
    EXECUTE $travel_stmt_36_$
    CREATE TRIGGER travel_airport_reference_drift_guard
      BEFORE UPDATE OR DELETE ON app.travel_airport_reference
      FOR EACH ROW EXECUTE FUNCTION app.protect_travel_airport_reference();
    $travel_stmt_36_$;
    EXECUTE $travel_stmt_37_$
    -- Curation stays owner-scoped. Its coordinates are optional pins for a
    -- reference code, or required source fields for a standalone endpoint.
    ALTER TABLE app.travel_airports
      ALTER COLUMN name DROP NOT NULL,
      ALTER COLUMN serves_place DROP NOT NULL,
      ALTER COLUMN city DROP NOT NULL,
      ALTER COLUMN country DROP NOT NULL,
      ALTER COLUMN latitude DROP NOT NULL,
      ALTER COLUMN longitude DROP NOT NULL,
      ADD COLUMN standalone boolean NOT NULL DEFAULT false;
    $travel_stmt_37_$;
    EXECUTE $travel_stmt_38_$
    ALTER TABLE app.travel_airports RENAME COLUMN catalogue_id TO reference_airport_id;
    $travel_stmt_38_$;
    EXECUTE $travel_stmt_39_$
    ALTER TABLE app.travel_airports DROP CONSTRAINT IF EXISTS travel_airports_catalogue_id_fkey;
    $travel_stmt_39_$;
    EXECUTE $travel_stmt_40_$
    ALTER TABLE app.travel_airports ADD CONSTRAINT travel_airports_standalone_fields_check CHECK (
        NOT standalone OR (
          reference_airport_id IS NULL AND name IS NOT NULL AND city IS NOT NULL AND
          country IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
        )
      );
    $travel_stmt_40_$;
    EXECUTE $travel_stmt_41_$
    ALTER TABLE app.travel_airports ADD CONSTRAINT travel_airports_reference_airport_id_fkey
      FOREIGN KEY (reference_airport_id) REFERENCES app.travel_airport_reference(id) ON DELETE SET NULL;
    $travel_stmt_41_$;
    EXECUTE $travel_stmt_42_$
    -- Keep legacy codes bound to the same catalogue row when the reference feed
    -- already contains a match. Duplicate IATA codes use the runtime precedence.
    UPDATE app.travel_airports c SET reference_airport_id = (
      SELECT a.id FROM app.travel_airport_reference a
      WHERE upper(a.code) = upper(c.code)
      ORDER BY a.scheduled_service DESC,
        CASE
          WHEN lower(a.type) IN ('large_airport', 'medium_airport') THEN 1
          WHEN lower(a.type) IN ('small_airport', 'closed') THEN 2
          WHEN lower(a.type) IN ('heliport', 'seaplane_base') THEN 3
          ELSE 4
        END,
        CASE WHEN lower(a.type) = 'closed' OR NOT a.active THEN 1 ELSE 0 END,
        a.source_id
      LIMIT 1
    )
    WHERE c.reference_airport_id IS NULL AND NOT c.standalone;
    $travel_stmt_42_$;
    EXECUTE $travel_stmt_43_$
    UPDATE app.travel_transport t SET
      origin_reference_id = COALESCE(t.origin_reference_id, (
        SELECT a.id FROM app.travel_airport_reference a
        WHERE upper(a.code) = upper(t.origin)
        ORDER BY a.scheduled_service DESC,
          CASE
            WHEN lower(a.type) IN ('large_airport', 'medium_airport') THEN 1
            WHEN lower(a.type) IN ('small_airport', 'closed') THEN 2
            WHEN lower(a.type) IN ('heliport', 'seaplane_base') THEN 3
            ELSE 4
          END,
          CASE WHEN lower(a.type) = 'closed' OR NOT a.active THEN 1 ELSE 0 END,
          a.source_id
        LIMIT 1
      )),
      destination_reference_id = COALESCE(t.destination_reference_id, (
        SELECT a.id FROM app.travel_airport_reference a
        WHERE upper(a.code) = upper(t.destination)
        ORDER BY a.scheduled_service DESC,
          CASE
            WHEN lower(a.type) IN ('large_airport', 'medium_airport') THEN 1
            WHEN lower(a.type) IN ('small_airport', 'closed') THEN 2
            WHEN lower(a.type) IN ('heliport', 'seaplane_base') THEN 3
            ELSE 4
          END,
          CASE WHEN lower(a.type) = 'closed' OR NOT a.active THEN 1 ELSE 0 END,
          a.source_id
        LIMIT 1
      ));
    $travel_stmt_43_$;
    EXECUTE $travel_stmt_44_$
    -- Airport requests are superseded by curation-only update, including the
    -- standalone path for station codes such as NYP.
    DROP TABLE app.airport_catalogue_requests;
    $travel_stmt_44_$;
  END IF;
END $travel_migration$;
-- +goose StatementEnd

-- +goose Down
-- The removed sheet IDs and residence source dates are intentionally not
-- reconstructed. The operator's frozen mapping snapshot is the recovery source.
-- Restore the pre-curation airport reference shape for local schema rollback.
-- +goose StatementBegin
DROP TRIGGER IF EXISTS travel_airport_reference_drift_guard ON app.travel_airport_reference;
DROP FUNCTION IF EXISTS app.protect_travel_airport_reference();
ALTER TABLE app.travel_airports
  DROP CONSTRAINT IF EXISTS travel_airports_standalone_fields_check,
  DROP COLUMN IF EXISTS standalone;
ALTER TABLE app.travel_residences
  DROP CONSTRAINT IF EXISTS travel_residences_owner_place_key;
ALTER TABLE app.travel_airport_reference RENAME TO airport_catalogue;
ALTER TABLE app.airport_catalogue RENAME COLUMN code TO iata_code;
ALTER TABLE app.airport_catalogue RENAME COLUMN city TO municipality;
ALTER TABLE app.airport_catalogue RENAME COLUMN country TO iso_country;
ALTER TABLE app.airport_catalogue RENAME COLUMN type TO airport_type;
ALTER TABLE app.travel_airports
  DROP CONSTRAINT IF EXISTS travel_airports_reference_airport_id_fkey,
  DROP CONSTRAINT IF EXISTS travel_airports_catalogue_id_fkey;
ALTER TABLE app.travel_airports RENAME COLUMN reference_airport_id TO catalogue_id;
ALTER TABLE app.travel_airports ADD CONSTRAINT travel_airports_catalogue_id_fkey
  FOREIGN KEY (catalogue_id) REFERENCES app.airport_catalogue(id) ON DELETE SET NULL;
ALTER TABLE app.airport_catalogue
  ADD COLUMN ident text,
  ADD COLUMN icao_code text,
  ADD COLUMN gps_code text,
  ADD COLUMN local_code text;
ALTER TABLE app.travel_airport_reference_refresh_log
  DROP COLUMN IF EXISTS source_name,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS retrieved_at,
  DROP COLUMN IF EXISTS row_count,
  DROP COLUMN IF EXISTS unchanged_count,
  DROP COLUMN IF EXISTS drift_flagged_count,
  DROP COLUMN IF EXISTS missing_flagged_count,
  DROP COLUMN IF EXISTS drift_entries,
  DROP COLUMN IF EXISTS missing_codes;
ALTER TABLE app.travel_airport_reference_refresh_log RENAME TO airport_catalogue_sync_runs;
CREATE TABLE app.airport_catalogue_requests (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  country text,
  code text,
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','rejected')),
  resolved_airport_id uuid REFERENCES app.airport_catalogue(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.travel_transport
  ADD COLUMN origin_airport_id uuid REFERENCES app.airport_catalogue(id) ON DELETE RESTRICT,
  ADD COLUMN destination_airport_id uuid REFERENCES app.airport_catalogue(id) ON DELETE RESTRICT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='travel_transport' AND column_name='origin_reference_id') THEN
    UPDATE app.travel_transport SET origin_airport_id=origin_reference_id,
      destination_airport_id=destination_reference_id;
    ALTER TABLE app.travel_transport DROP COLUMN origin_reference_id, DROP COLUMN destination_reference_id;
  END IF;
END $$;
ALTER TABLE app.travel_journeys ADD COLUMN legacy_id text;
ALTER TABLE app.travel_places ADD COLUMN legacy_id text;
ALTER TABLE app.travel_journey_segments ADD COLUMN legacy_id text;
ALTER TABLE app.travel_transport ADD COLUMN legacy_id text;
ALTER TABLE app.travel_stays ADD COLUMN legacy_id text;
ALTER TABLE app.travel_ideas ADD COLUMN legacy_id text;
ALTER TABLE app.travel_residences
  ADD COLUMN legacy_id text,
  ADD COLUMN source_first_visited date,
  ADD COLUMN source_last_visited date;
ALTER TABLE app.travel_airports ADD COLUMN legacy_id text;
-- +goose StatementEnd
