-- Product-native files and source labels. No ingestion pipeline tables in the canonical MVP schema.
CREATE TABLE app.files (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  storage_key text NOT NULL, original_name text NOT NULL, mimetype text NOT NULL, size integer NOT NULL, url text NOT NULL,
  content text, text_content text, metadata jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.note_files (
  note_id uuid NOT NULL, file_id uuid NOT NULL REFERENCES app.files(id) ON DELETE CASCADE,
  attached_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (note_id, file_id)
);
