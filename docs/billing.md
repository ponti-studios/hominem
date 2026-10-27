# Billing and paid tiers

Hominem sells four tiers. Stripe takes the money and is the system of record; the API holds the
account state it enforces and never trusts a browser for it.

The prices are decided and are listed here only because code must charge something. The monthly
volume caps belong to the **"Hominem — Paid Tier Plan" sheet**; the values below are the currently
deployed configuration and can be changed from the environment without a rule change.

| Tier          | Price          | Skills                        | Monthly conversation |
| ------------- | -------------- | ----------------------------- | -------------------- |
| Taster        | £0             | capped by volume, all domains | 50 messages          |
| Core          | £9.99 / month  | uncapped                      | 1,000 messages       |
| AI            | £19.99 / month | uncapped                      | 3,000 messages       |
| Founding Core | £7.99 / month  | uncapped                      | 1,000 messages       |

Founding Core is the first **100** Core subscriptions. The price is locked for as long as that
subscription stays subscribed, including when the holder changes tier. A seat is released when its
subscription ends or its paid period expires; a scheduled cancellation keeps the seat through the
paid period. The seat counter is written inside one transaction with an advisory lock, so two
simultaneous signups cannot both take seat 100. A founding Checkout that loses that race is repriced
to £9.99 by the webhook before it is stored.

## What a tier gates

A person's plan is derived from their `app.billing_subscriptions` row, never from the request:

- `active` or `trialing` **and** inside `current_period_end` → the paid tier (`founding` turns Core
  into Founding Core).
- `cancel_at_period_end` keeps access until the paid period ends.
- Anything else — `past_due`, `unpaid`, `canceled`, `incomplete`, `paused` — is Taster immediately.

A plan is blocked by **volume, never by domain**. Every tier can reach every skill; the difference
is how much can be used. The two counters are:

- `chat` — one row per Conversation message, counted at generation start
  (`services/api/src/chat/chat-generation-commands.ts`). Every tier has a finite cap, so uncapped
  conversation is impossible.
- `skill` — one row per MCP tool invocation (`services/api/src/mcp/server.ts`). Taster has a finite
  monthly volume; Core, AI and Founding Core do not.

Both counters are calendar-month, UTC. `app.billing_usage_events` is the ledger, and enforcement is
one atomic `INSERT … WHERE count < limit`, so two calls at the boundary cannot both pass.

## Paying

`GET /billing` on the API is the pay surface: it lists the plans, starts a Stripe Checkout, and
offers a downgrade or a cancellation to anyone already paying. Signed-out visitors go through the
hosted login first.

- `POST /billing/checkout` — starts a monthly `mode=subscription` Checkout. Core uses the founding
  price while seats remain.
- `POST /billing/change` — changes an existing subscription's tier now (AI → Core is the downgrade).
- `POST /billing/cancel` — sets `cancel_at_period_end`; access continues until the period ends.
- `POST /webhooks/stripe/billing` — the only writer of account state. It verifies
  `Stripe-Signature` against the raw body, and applies `customer.subscription.created`,
  `updated` and `deleted`. A `5xx` makes Stripe retry; the upsert makes a repeat safe.

The subscription carries `metadata.user_id`, `metadata.tier` and `metadata.founding`, which is what
the webhook uses to know whose account to write. Account state is one row per person: a new
subscription overwrites the old one, so access can never come from a stale row.

## Configuration

| Variable                        | Meaning                                                |
| ------------------------------- | ------------------------------------------------------ |
| `STRIPE_SECRET_KEY`             | Stripe API key. No key means billing endpoints 503.    |
| `STRIPE_API_BASE_URL`           | Local Stripe fake, development only.                   |
| `BILLING_STRIPE_WEBHOOK_SECRET` | Signing secret for `/webhooks/stripe/billing`.         |
| `BILLING_TASTER_CHAT_MESSAGES`  | Taster monthly conversation cap.                       |
| `BILLING_CORE_CHAT_MESSAGES`    | Core and Founding Core monthly conversation cap.       |
| `BILLING_AI_CHAT_MESSAGES`      | AI monthly conversation cap.                           |
| `BILLING_TASTER_SKILL_CALLS`    | Taster monthly skill-call volume. Paid tiers uncapped. |

Stripe prices are created ad hoc per Checkout (`price_data`), so no price IDs need to be seeded for
a new environment. Register the webhook endpoint in the Stripe dashboard and put its signing secret
in `BILLING_STRIPE_WEBHOOK_SECRET` (or reuse `STRIPE_WEBHOOK_SECRET`).

## Rules for changes

- Change a price only against the plan sheet, and change it here (and in `TIER_PRICES_PENCE`) in
  the same commit. Never infer a price from a Stripe dashboard value at runtime.
- Never let a cancel, a lapse, or a failed payment keep both a paid plan and access. `planFor` in
  `services/api/src/application/billing.ts` is the single answer to "what does this subscription
  grant now".
- Enforce a tier at the boundary where the work is started, not in the UI. The billing page shows
  usage; it does not decide access.
