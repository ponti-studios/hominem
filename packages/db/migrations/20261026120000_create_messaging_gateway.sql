-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.messaging_identities (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel = 'telegram'),
  external_user_id text NOT NULL,
  external_chat_id text NOT NULL,
  chat_id uuid NOT NULL REFERENCES app.chats(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_inbound_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX messaging_identities_channel_external_user_active_idx
  ON app.messaging_identities (channel, external_user_id)
  WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX messaging_identities_owner_channel_active_idx
  ON app.messaging_identities (owner_user_id, channel)
  WHERE revoked_at IS NULL;
CREATE INDEX messaging_identities_chat_idx ON app.messaging_identities (chat_id);

CREATE TABLE app.messaging_link_codes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel = 'telegram'),
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messaging_link_codes_owner_idx ON app.messaging_link_codes (owner_user_id, created_at DESC);

ALTER TABLE app.messaging_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messaging_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY messaging_identities_owner_policy ON app.messaging_identities
  FOR ALL USING (auth.is_service_role() OR owner_user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_user_id = auth.current_user_id());

ALTER TABLE app.messaging_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messaging_link_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY messaging_link_codes_owner_policy ON app.messaging_link_codes
  FOR ALL USING (auth.is_service_role() OR owner_user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_user_id = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS messaging_link_codes_owner_policy ON app.messaging_link_codes;
ALTER TABLE IF EXISTS app.messaging_link_codes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app.messaging_link_codes DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS app.messaging_link_codes;
DROP POLICY IF EXISTS messaging_identities_owner_policy ON app.messaging_identities;
ALTER TABLE IF EXISTS app.messaging_identities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app.messaging_identities DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS app.messaging_identities;
-- +goose StatementEnd
