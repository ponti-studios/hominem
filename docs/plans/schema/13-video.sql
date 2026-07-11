-- Up: dedicated video domain, split out of the generic media-work model.
CREATE TABLE app.video_channels (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (btrim(source) <> ''), external_id text, name text NOT NULL CHECK (btrim(name) <> ''), handle text, image text,
  subscriber_count integer CHECK (subscriber_count IS NULL OR subscriber_count >= 0), description text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.video_views (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, channel_id uuid REFERENCES app.video_channels(id) ON DELETE SET NULL,
  content_type text NOT NULL CHECK (content_type IN ('video','episode','movie','clip','short')), source text NOT NULL CHECK (btrim(source) <> ''), external_id text,
  title text NOT NULL CHECK (btrim(title) <> ''), description text, thumbnail_url text, duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  watched_at timestamptz NOT NULL, watch_time_seconds integer NOT NULL DEFAULT 0 CHECK (watch_time_seconds >= 0), completed boolean NOT NULL DEFAULT false,
  season_number integer CHECK (season_number IS NULL OR season_number > 0), episode_number integer CHECK (episode_number IS NULL OR episode_number > 0),
  channel_name text, metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_video_views_owner_watched ON app.video_views(owner_userid, watched_at DESC);
