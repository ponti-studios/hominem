-- Reconciled Up: sharing/spaces, and the real (service-role) audit mechanism. Better Auth owns authentication tables.
-- NOT YET IMPLEMENTED, left as future scope, not renamed: app.person_profiles, app.access_grants, app.data_deletion_requests.
CREATE TABLE app.spaces (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), description text, color text, icon text, is_ordered boolean NOT NULL DEFAULT false,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.entities ADD CONSTRAINT entities_primary_space_id_fkey
  FOREIGN KEY (primary_space_id) REFERENCES app.spaces(id) ON DELETE SET NULL;
ALTER TABLE app.entity_links ADD CONSTRAINT entity_links_space_id_fkey
  FOREIGN KEY (space_id) REFERENCES app.spaces(id) ON DELETE SET NULL;
CREATE TABLE app.space_members (
  id uuid PRIMARY KEY DEFAULT uuidv7(), space_id uuid NOT NULL REFERENCES app.spaces(id) ON DELETE CASCADE,
  userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, added_by_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  membership_period tstzrange NOT NULL DEFAULT tstzrange(now(), 'infinity', '[)'), createdAt timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT isempty(membership_period))
);
CREATE TABLE app.space_invites (
  id uuid PRIMARY KEY DEFAULT uuidv7(), space_id uuid NOT NULL REFERENCES app.spaces(id) ON DELETE CASCADE,
  inviter_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, invited_user_email text NOT NULL CHECK (btrim(invited_user_email) <> ''),
  invited_userid text REFERENCES "user"(id) ON DELETE SET NULL, invite_token text NOT NULL CHECK (btrim(invite_token) <> ''),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  accepted_at timestamptz, revokedAt timestamptz, expiresAt timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  invited_user_email_normalized text GENERATED ALWAYS AS (lower(invited_user_email)) STORED,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  invite_window tstzrange GENERATED ALWAYS AS (tstzrange(createdAt, coalesce(accepted_at, revokedAt, expiresAt, 'infinity'), '[)')) STORED,
  CHECK (accepted_at IS NULL OR accepted_at >= createdAt), CHECK (revokedAt IS NULL OR revokedAt >= createdAt), CHECK (expiresAt >= createdAt)
);
CREATE TABLE app.space_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(), space_id uuid NOT NULL REFERENCES app.spaces(id) ON DELETE CASCADE,
  entity_table regclass NOT NULL, entity_id uuid NOT NULL, added_by_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz, "position" numeric(18,6), is_pinned boolean NOT NULL DEFAULT false,
  membership_period tstzrange GENERATED ALWAYS AS (tstzrange(added_at, coalesce(removed_at, 'infinity'), '[)')) STORED,
  metadata jsonb NOT NULL DEFAULT '{}', CHECK (removed_at IS NULL OR removed_at >= added_at)
);
CREATE TABLE app.space_tags (
  id uuid PRIMARY KEY DEFAULT uuidv7(), space_id uuid NOT NULL REFERENCES app.spaces(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES app.tags(id) ON DELETE CASCADE, created_by_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  createdAt timestamptz NOT NULL DEFAULT now()
);
-- Audit is service-role scoped (auth.is_service_role()), not owner-scoped: excluded from 99-row-level-security.sql's owner_isolation loop.
CREATE TABLE ops.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuidv7(), actor_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (btrim(action) <> ''), entity_schema text, entity_table text, entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ops.search_logs (
  id uuid PRIMARY KEY DEFAULT uuidv7(), actor_userid text REFERENCES "user"(id) ON DELETE SET NULL,
  query text NOT NULL CHECK (btrim(query) <> ''), scope text, results_count integer CHECK (results_count IS NULL OR results_count >= 0),
  clicked_entity_type text, clicked_entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_space_members_userid ON app.space_members(userid);
CREATE INDEX idx_ops_audit_logs_actor ON ops.audit_logs(actor_userid, createdAt DESC) WHERE actor_userid IS NOT NULL;
CREATE INDEX idx_ops_audit_logs_entity ON ops.audit_logs(entity_schema, entity_table, entity_id, createdAt DESC) WHERE entity_id IS NOT NULL;
