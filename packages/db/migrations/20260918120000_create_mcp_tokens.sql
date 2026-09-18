-- +goose Up
-- +goose StatementBegin
-- Personal access tokens for the MCP server (/api/mcp). The API mints a raw
-- `hmt_` token once and stores only its SHA-256 hash; the raw value is never
-- retrievable again. `scopes` is an allow-list from MCP_SCOPES; an empty array
-- means "all scopes" (resolved against the live scope set at request time), so
-- new scopes reach existing tokens automatically and a scoped token later only
-- needs a non-empty array.
CREATE TABLE app.mcp_tokens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_mcp_tokens_owner_idx
  ON app.mcp_tokens (owner_userId);

ALTER TABLE app.mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.mcp_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY app_mcp_tokens_owner_policy ON app.mcp_tokens
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS app_mcp_tokens_owner_policy ON app.mcp_tokens;
ALTER TABLE IF EXISTS app.mcp_tokens NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app.mcp_tokens DISABLE ROW LEVEL SECURITY;
DROP INDEX IF EXISTS app.app_mcp_tokens_owner_idx;
DROP TABLE IF EXISTS app.mcp_tokens;
-- +goose StatementEnd