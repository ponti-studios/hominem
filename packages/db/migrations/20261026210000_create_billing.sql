-- +goose Up
-- +goose StatementBegin
-- Paid tiers (docs/billing.md). Stripe is the system of record for money; this table is the
-- account state the API enforces, written only by the verified Stripe webhook (and the
-- downgrade/cancel commands, which Stripe confirms). One row per person: a new subscription
-- replaces the old one, so access can never come from a stale row.

CREATE TABLE IF NOT EXISTS app.billing_subscriptions (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  -- The paid tier the subscription is for. Taster has no row.
  tier text NOT NULL CHECK (tier IN ('core', 'ai')),
  status text NOT NULL CHECK (
    status IN (
      'active',
      'trialing',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  ),
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  -- What this subscription actually charges, in pence: 999, 1999, or the locked 799 founding price.
  price_pence integer NOT NULL CHECK (price_pence > 0),
  -- One of the first 100 Core subscriptions keeps £7.99 for as long as it stays subscribed.
  founding boolean NOT NULL DEFAULT false,
  -- Stripe's current period end. A cancelled subscription keeps access until this instant.
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Counting founding seats stays cheap however many people subscribe.
CREATE INDEX IF NOT EXISTS billing_subscriptions_founding_idx
  ON app.billing_subscriptions (founding)
  WHERE founding;

-- One row per billable interaction, so a tier's monthly volume can be counted and capped.
-- Chat messages and MCP skill calls are counted separately: a tier may cap one without the other.
CREATE TABLE IF NOT EXISTS app.billing_usage_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chat', 'skill')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_usage_events_user_kind_created_idx
  ON app.billing_usage_events (user_id, kind, created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.billing_usage_events;
DROP TABLE IF EXISTS app.billing_subscriptions;
-- +goose StatementEnd
