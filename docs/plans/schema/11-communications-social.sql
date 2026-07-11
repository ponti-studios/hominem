-- Up: sender-only resolution, no participant roster, no message attachments, no social_posts.
-- social_interactions moved to 06-people-organizations.sql (it is people/org contact history, not messaging).
CREATE TABLE app.communication_threads (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source text, external_id text, title text, channel text NOT NULL CHECK (channel IN ('email','sms','signal','social','other')),
  sensitivity text NOT NULL DEFAULT 'private' CHECK (sensitivity IN ('private','sensitive','restricted')),
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
-- sender is resolved directly on the message; there is no participant roster for the rest of the thread.
CREATE TABLE app.communication_messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, thread_id uuid NOT NULL REFERENCES app.communication_threads(id) ON DELETE CASCADE,
  sender_person_id uuid REFERENCES app.people(id) ON DELETE SET NULL, external_id text,
  sent_at timestamptz NOT NULL, direction text NOT NULL CHECK (direction IN ('inbound','outbound','unknown')),
  body_file_id uuid REFERENCES app.files(id) ON DELETE SET NULL, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_communication_messages_owner_sent ON app.communication_messages(owner_userid, sent_at DESC);
