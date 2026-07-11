-- Up: notes double as versioned CMS content; no separate documents table.
CREATE TABLE app.notes (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  parent_note_id uuid REFERENCES app.notes(id) ON DELETE SET NULL, current_version_id uuid,
  source text, is_locked boolean NOT NULL DEFAULT false, title text, content text NOT NULL DEFAULT '', excerpt text, archived_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.note_versions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), note_id uuid NOT NULL REFERENCES app.notes(id) ON DELETE CASCADE, created_by_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  version_number integer NOT NULL CHECK (version_number > 0), title text, content text, excerpt text,
  note_type text NOT NULL DEFAULT 'note' CHECK (note_type IN ('note','document','template')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  mentions jsonb NOT NULL DEFAULT '[]', analysis jsonb, publishing_metadata jsonb, published_at timestamptz, scheduled_for timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (scheduled_for IS NULL OR published_at IS NULL OR scheduled_for <= published_at)
);
ALTER TABLE app.notes ADD CONSTRAINT notes_current_version_id_fkey FOREIGN KEY (current_version_id) REFERENCES app.note_versions(id) ON DELETE SET NULL;
CREATE TABLE app.chats (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, note_id uuid REFERENCES app.notes(id) ON DELETE SET NULL,
  primary_space_id uuid REFERENCES app.spaces(id) ON DELETE SET NULL, title text NOT NULL CHECK (btrim(title) <> ''), source text,
  archived_at timestamptz, last_message_at timestamptz NOT NULL DEFAULT now(),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (last_message_at >= createdAt)
);
CREATE TABLE app.chat_messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(), chat_id uuid NOT NULL REFERENCES app.chats(id) ON DELETE CASCADE, author_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  parent_message_id uuid REFERENCES app.chat_messages(id) ON DELETE SET NULL, role text NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content text NOT NULL CHECK (btrim(content) <> ''), files jsonb, tool_calls jsonb, reasoning text, referenced_note_ids jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.tasks (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, primary_space_id uuid REFERENCES app.spaces(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES app.tasks(id) ON DELETE SET NULL, title text NOT NULL CHECK (btrim(title) <> ''), description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','archived')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')), due_at timestamptz, completed_at timestamptz,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK ((completed_at IS NULL AND status <> 'completed') OR (completed_at IS NOT NULL AND status = 'completed'))
);
CREATE TABLE app.task_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(), task_id uuid NOT NULL REFERENCES app.tasks(id) ON DELETE CASCADE, primary_space_id uuid NOT NULL REFERENCES app.spaces(id) ON DELETE CASCADE,
  assignee_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, assigned_by_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  assignment_period tstzrange NOT NULL DEFAULT tstzrange(now(), 'infinity', '[)'), metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), CHECK (NOT isempty(assignment_period))
);
CREATE TABLE app.extracted_facts (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject_table regclass, subject_id uuid, predicate text NOT NULL CHECK (btrim(predicate) <> ''), object_value jsonb NOT NULL,
  source_label text, evidence jsonb NOT NULL DEFAULT '{}', confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  observed_at timestamptz, createdAt timestamptz NOT NULL DEFAULT now()
);
-- entity_type is deliberately narrow: only notes and chats are embedded today, not every domain table.
CREATE TABLE app.vector_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('note','chat')), entity_id uuid NOT NULL, content text NOT NULL,
  embedding vector(1536) NOT NULL, metadata jsonb, createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.bookmarks (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, place_id uuid,
  title text NOT NULL CHECK (btrim(title) <> ''), description text, url text NOT NULL CHECK (btrim(url) <> ''), metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
-- note_files is defined in 03-files-sources-evidence.sql. note_shares is a second, note-scoped sharing mechanism (see plan divergence note).
CREATE TABLE app.note_shares (
  id uuid PRIMARY KEY DEFAULT uuidv7(), note_id uuid NOT NULL REFERENCES app.notes(id) ON DELETE CASCADE,
  shared_with_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, permission text NOT NULL DEFAULT 'read' CHECK (permission IN ('read','write')),
  granted_by_userid text REFERENCES "user"(id) ON DELETE SET NULL, expiresAt timestamptz, revokedAt timestamptz,
  access_period tstzrange GENERATED ALWAYS AS (tstzrange(createdAt, coalesce(revokedAt, expiresAt, 'infinity'), '[)')) STORED,
  createdAt timestamptz NOT NULL DEFAULT now(),
  CHECK (expiresAt IS NULL OR expiresAt >= createdAt), CHECK (revokedAt IS NULL OR revokedAt >= createdAt)
);
ALTER TABLE app.note_files ADD CONSTRAINT note_files_note_id_fkey FOREIGN KEY (note_id) REFERENCES app.notes(id) ON DELETE CASCADE;
CREATE INDEX idx_notes_owner_updated ON app.notes(owner_userid, updatedAt DESC);
CREATE INDEX idx_vector_documents_embedding ON app.vector_documents USING hnsw (embedding vector_cosine_ops);
