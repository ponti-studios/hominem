-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.billing_memberships (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'osmium' CHECK (tier = 'osmium'),
  granted_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((revoked_by_user_id IS NULL) = (revoked_at IS NULL))
);

CREATE INDEX billing_memberships_active_idx
  ON app.billing_memberships (user_id)
  WHERE revoked_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.billing_memberships;
-- +goose StatementEnd
