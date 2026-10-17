-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF to_regclass('app.credential_allowed_emails') IS NULL THEN
    CREATE TABLE app.credential_allowed_emails (
      email text PRIMARY KEY CHECK (email = lower(email)),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    COMMENT ON TABLE app.credential_allowed_emails IS
      'created by 20261017044700 compatibility repair';
  END IF;

  IF to_regclass('app.credential_blocks') IS NULL THEN
    CREATE TABLE app.credential_blocks (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      blocked_at timestamptz NOT NULL DEFAULT now()
    );
    COMMENT ON TABLE app.credential_blocks IS
      'created by 20261017044700 compatibility repair';
  END IF;

  IF to_regclass('app.provider_credentials') IS NULL THEN
    CREATE TABLE app.provider_credentials (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      device_id text NOT NULL CHECK (length(device_id) BETWEEN 8 AND 128),
      key_hash text NOT NULL UNIQUE,
      period text NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
      limit_usd numeric(10, 4) NOT NULL CHECK (limit_usd > 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz,
      disabled_at timestamptz
    );
    COMMENT ON TABLE app.provider_credentials IS
      'created by 20261017044700 compatibility repair';
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS provider_credentials_live_device_idx
    ON app.provider_credentials (user_id, device_id)
    WHERE revoked_at IS NULL;
  CREATE INDEX IF NOT EXISTS provider_credentials_user_period_idx
    ON app.provider_credentials (user_id, period);
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  IF to_regclass('app.provider_credentials') IS NOT NULL
     AND obj_description('app.provider_credentials'::regclass, 'pg_class') =
       'created by 20261017044700 compatibility repair' THEN
    DROP TABLE app.provider_credentials;
  END IF;
  IF to_regclass('app.credential_blocks') IS NOT NULL
     AND obj_description('app.credential_blocks'::regclass, 'pg_class') =
       'created by 20261017044700 compatibility repair' THEN
    DROP TABLE app.credential_blocks;
  END IF;
  IF to_regclass('app.credential_allowed_emails') IS NOT NULL
     AND obj_description('app.credential_allowed_emails'::regclass, 'pg_class') =
       'created by 20261017044700 compatibility repair' THEN
    DROP TABLE app.credential_allowed_emails;
  END IF;
END $$;
-- +goose StatementEnd
