-- Up: no aliases/collections/residences (see chapter divergence note).
CREATE TABLE app.places (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), address text, latitude numeric(9,6), longitude numeric(9,6),
  place_type text, source text, external_id text, rating numeric(2,1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  notes text, provider_payload jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90), CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE TABLE app.place_visits (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, place_id uuid NOT NULL REFERENCES app.places(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL, ended_at timestamptz, purpose text, source text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE app.travel_trips (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), description text, start_date date NOT NULL, end_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','booked','in_progress','completed','cancelled')), notes text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE TABLE app.travel_segments (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, trip_id uuid NOT NULL REFERENCES app.travel_trips(id) ON DELETE CASCADE,
  segment_type text NOT NULL CHECK (segment_type IN ('flight','rail','road','lodging','other')), provider text, confirmation_code text,
  departs_at timestamptz, arrives_at timestamptz, origin_place_id uuid REFERENCES app.places(id) ON DELETE SET NULL, destination_place_id uuid REFERENCES app.places(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (arrives_at IS NULL OR departs_at IS NULL OR arrives_at >= departs_at)
);
CREATE INDEX idx_place_visits_owner_start ON app.place_visits(owner_userid, started_at DESC);
ALTER TABLE app.bookmarks ADD CONSTRAINT bookmarks_place_id_fkey FOREIGN KEY (place_id) REFERENCES app.places(id) ON DELETE SET NULL;
