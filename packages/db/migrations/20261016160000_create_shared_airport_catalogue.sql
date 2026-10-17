-- +goose Up
CREATE TABLE app.airport_catalogue (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id bigint NOT NULL UNIQUE,
  ident text NOT NULL,
  iata_code text,
  icao_code text,
  gps_code text,
  local_code text,
  name text NOT NULL,
  municipality text,
  iso_country text,
  latitude double precision,
  longitude double precision,
  airport_type text NOT NULL,
  scheduled_service boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  source_updated_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX airport_catalogue_iata_idx ON app.airport_catalogue (upper(iata_code)) WHERE active;
CREATE INDEX airport_catalogue_icao_idx ON app.airport_catalogue (upper(icao_code)) WHERE active;
CREATE INDEX airport_catalogue_gps_idx ON app.airport_catalogue (upper(gps_code)) WHERE active;
CREATE INDEX airport_catalogue_local_idx ON app.airport_catalogue (upper(local_code)) WHERE active;
CREATE INDEX airport_catalogue_name_idx ON app.airport_catalogue USING gin (name gin_trgm_ops) WHERE active;
CREATE INDEX airport_catalogue_municipality_idx ON app.airport_catalogue USING gin (municipality gin_trgm_ops) WHERE active;

CREATE TABLE app.airport_catalogue_sync_runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_version text NOT NULL,
  source_checksum text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  seen_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  deactivated_count integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX airport_catalogue_sync_runs_started_idx ON app.airport_catalogue_sync_runs (started_at DESC);

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
CREATE UNIQUE INDEX airport_catalogue_request_open_dedup_idx
  ON app.airport_catalogue_requests (owner_userid, lower(name), lower(coalesce(city,'')), lower(coalesce(country,'')))
  WHERE status = 'open';
CREATE INDEX airport_catalogue_requests_status_idx ON app.airport_catalogue_requests (status, created_at DESC);

ALTER TABLE app.travel_transport
  ADD COLUMN origin_airport_id uuid REFERENCES app.airport_catalogue(id) ON DELETE RESTRICT,
  ADD COLUMN destination_airport_id uuid REFERENCES app.airport_catalogue(id) ON DELETE RESTRICT;

-- Legacy owner-scoped airports remain as a reconciliation/source-of-history table.
-- Codes are still used by rail and historical exports; new catalogue selections use
-- the stable shared IDs above.

-- +goose Down
ALTER TABLE app.travel_transport DROP COLUMN destination_airport_id, DROP COLUMN origin_airport_id;
DROP TABLE app.airport_catalogue_requests;
DROP TABLE app.airport_catalogue_sync_runs;
DROP TABLE app.airport_catalogue;
