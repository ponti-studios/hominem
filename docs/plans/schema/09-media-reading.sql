-- Up: no editions/creators/collections/sessions tables -- creators is a denormalized jsonb array.
CREATE TABLE app.media_works (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  work_type text NOT NULL CHECK (work_type IN ('book','article','podcast','film','show','game','other')),
  title text NOT NULL CHECK (btrim(title) <> ''), creators jsonb NOT NULL DEFAULT '[]', external_id text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.media_consumptions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, media_work_id uuid NOT NULL REFERENCES app.media_works(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','abandoned')),
  started_at timestamptz, completed_at timestamptz, progress numeric(7,2) CHECK (progress IS NULL OR progress >= 0),
  rating numeric(3,1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 10), notes text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
