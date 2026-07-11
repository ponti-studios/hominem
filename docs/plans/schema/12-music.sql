-- Up: dedicated music domain, split out of the generic media-work model.
CREATE TABLE app.music_artists (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (btrim(source) <> ''), external_id text, name text NOT NULL CHECK (btrim(name) <> ''), image_url text, genre text,
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.music_albums (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, artist_id uuid REFERENCES app.music_artists(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (btrim(source) <> ''), external_id text, title text NOT NULL CHECK (btrim(title) <> ''), artist_name text,
  release_date date, album_art_url text, genre text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.music_tracks (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES app.music_artists(id) ON DELETE SET NULL, album_id uuid REFERENCES app.music_albums(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (btrim(source) <> ''), external_id text, title text NOT NULL CHECK (btrim(title) <> ''),
  artist_name text, album_name text, album_art_url text, duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  track_number integer CHECK (track_number IS NULL OR track_number > 0), disc_number integer CHECK (disc_number IS NULL OR disc_number > 0),
  isrc text, genre text, metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.music_playlists (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (btrim(source) <> ''), external_id text, name text NOT NULL CHECK (btrim(name) <> ''), description text, image_url text,
  is_public boolean NOT NULL DEFAULT false, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.music_playlist_tracks (
  playlist_id uuid NOT NULL REFERENCES app.music_playlists(id) ON DELETE CASCADE, track_id uuid NOT NULL REFERENCES app.music_tracks(id) ON DELETE CASCADE,
  "position" integer NOT NULL CHECK ("position" > 0), added_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (playlist_id, track_id)
);
CREATE TABLE app.music_listens (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, track_id uuid REFERENCES app.music_tracks(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (btrim(source) <> ''), started_at timestamptz NOT NULL, ended_at timestamptz, duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  completed boolean NOT NULL DEFAULT false, context_type text, context_id text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX idx_music_listens_owner_started ON app.music_listens(owner_userid, started_at DESC);
