-- +goose Up
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE app.vector_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('note', 'chat')),
  entity_id uuid NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX app_vector_documents_owner_idx ON app.vector_documents (owner_userId);

CREATE INDEX app_vector_documents_embedding_idx
  ON app.vector_documents USING hnsw (embedding vector_cosine_ops);

-- +goose Down
DROP TABLE IF EXISTS app.vector_documents;
DROP EXTENSION IF EXISTS vector;
