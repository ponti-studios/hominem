-- +goose Up
-- +goose StatementBegin
-- Thames credit: a prepaid balance in pence (GBP), the ledger behind it, and the card payments
-- that fill it (docs/prd/top-up.md in the Thames repo). Server-only bookkeeping: the API is the
-- only reader and writer, so these tables carry no owner RLS policy.
-- The balance is never stored; it is the ledger total minus what the person's keys have spent.

CREATE TABLE app.credit_ledger (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- grant: the free credit on joining. topup: a paid top-up. adjust: a manual correction.
  kind text NOT NULL CHECK (kind IN ('grant', 'topup', 'adjust')),
  amount_pence integer NOT NULL CHECK (amount_pence <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_ledger_user_idx ON app.credit_ledger (user_id, created_at);

-- One free grant per person.
CREATE UNIQUE INDEX credit_ledger_one_grant_idx ON app.credit_ledger (user_id) WHERE kind = 'grant';

-- One row per Stripe Checkout session the webhook has handled. The primary key makes a retried
-- webhook a no-op, so a payment can never be credited twice.
CREATE TABLE app.credit_payments (
  stripe_session_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- What the person paid and the credit that gave them, both in pence.
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  credit_pence integer NOT NULL CHECK (credit_pence > 0),
  -- credited: added to the ledger. refunded_not_uk: paid from outside the UK and refunded in full.
  status text NOT NULL CHECK (status IN ('credited', 'refunded_not_uk')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_payments_user_idx ON app.credit_payments (user_id, created_at);

-- When the "running low" email last went out, so one low spell sends one email. Cleared by a top-up.
CREATE TABLE app.credit_state (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  low_notified_at timestamptz
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.credit_state;
DROP TABLE IF EXISTS app.credit_payments;
DROP TABLE IF EXISTS app.credit_ledger;
-- +goose StatementEnd
