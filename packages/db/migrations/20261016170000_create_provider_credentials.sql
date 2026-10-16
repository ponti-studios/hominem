-- +goose Up
-- +goose StatementBegin
-- Per-person, per-device provider (OpenRouter) credentials for Thames.
-- Server-only bookkeeping: the API is the only reader and writer, so these
-- tables carry no owner RLS policy. A key itself is never stored, only its hash.

-- Emails allowed to receive a credential (lower case). Sign-in itself stays open
-- for the other apps; this gates only minting a provider key.
CREATE TABLE app.credential_allowed_emails (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A persistent administrative cutoff: a blocked person cannot mint again, even
-- after signing out and in. Different from rotation, which is routine.
CREATE TABLE app.credential_blocks (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.provider_credentials (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 8 AND 128),
  key_hash text NOT NULL UNIQUE,
  -- The calendar month (UTC, 'YYYY-MM') whose budget this key was granted from.
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  limit_usd numeric(10, 4) NOT NULL CHECK (limit_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set when the person or an admin ends the key; the key is then disabled at the provider.
  revoked_at timestamptz,
  -- Set once the provider confirmed the key is disabled. A revoked row with no disabled_at is
  -- retried by the reaper in scripts/credentials-admin.ts.
  disabled_at timestamptz
);

-- At most one live key per person per device.
CREATE UNIQUE INDEX provider_credentials_live_device_idx
  ON app.provider_credentials (user_id, device_id)
  WHERE revoked_at IS NULL;

CREATE INDEX provider_credentials_user_period_idx
  ON app.provider_credentials (user_id, period);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.provider_credentials;
DROP TABLE IF EXISTS app.credential_blocks;
DROP TABLE IF EXISTS app.credential_allowed_emails;
-- +goose StatementEnd
