# Billing and paid tiers

Hominem offers free Taster, paid Core, Rhodium, and Iridium, plus assigned Osmium membership. Stripe
takes payment for paid tiers; the API stores the account state it enforces and never trusts a browser
for it.

The prices and token allowances are modeled in the **"Hominem — Paid Tier Plan" sheet**. The
displayed token allowances and hidden AI spend guards are deployed configuration in
`services/api/src/application/billing.ts`. Taster's message and MCP caps remain environment
settings.

| Plan    | Price          | Monthly AI allowance | Hidden spend guard | Monthly conversation | MCP calls |
| ------- | -------------- | -------------------- | ------------------ | -------------------- | --------- |
| Taster  | £0             | 1M tokens            | $10                | 50 messages          | 500       |
| Core    | £9.99 / month  | 3.9M tokens          | $2.50              | token-metered        | unlimited |
| Rhodium | £19.99 / month | 8.5M tokens          | $5.45              | token-metered        | unlimited |
| Iridium | £39.99 / month | 18M tokens           | $11.40             | token-metered        | unlimited |
| Osmium  | Complimentary  | unlimited            | none               | unlimited            | unlimited |

AI and Founding Core are retired and are not available for new Stripe subscriptions or plan changes.
The existing Founding Core price lock remains supported for legacy records; no new founding seats
are issued. Founding Core keeps its £7.99 price and Core's token allowance; legacy AI keeps its
£19.99 price and Rhodium's token allowance. Paid tiers are token-metered, including these legacy
records. There were no active app subscribers when those offers were retired.

## What a plan gates

A person's plan is derived from billing records, never from the request. An active row in
`app.billing_memberships` grants Osmium and takes precedence over Stripe billing. Otherwise, plan
access comes from `app.billing_subscriptions`:

- `active` or `trialing` **and** inside `current_period_end` → the paid plan (`founding` turns Core
  into Founding Core; a legacy AI record remains AI).
- `cancel_at_period_end` keeps access until the paid period ends.
- Anything else — `past_due`, `unpaid`, `canceled`, `incomplete`, `paused` — is Taster immediately.

A plan is blocked by **volume, never by domain**. Every plan can reach every skill; the difference is
how much can be used. Osmium has no message, MCP, or monthly AI spend cap. Usage continues to be
recorded. Current paid tiers have a user-visible token allowance and a hidden provider-spend guard.
The guard protects tier economics and is separate from the displayed token budget. Taster retains
its AI spend guard and message/MCP caps. Usage resets on the UTC calendar month. The two volume
counters are:

- `chat` — one row per Conversation message, counted at generation start
  (`services/api/src/chat/chat-generation-commands.ts`). Taster has a finite message cap; paid tiers
  are token-metered; Osmium is unlimited.
- `skill` — one row per MCP tool invocation (`services/api/src/mcp/server.ts`). Taster has a finite
  monthly volume; paid plans do not. `/account/usage` shows MCP tool-call usage and the AI allowance
  as a percentage of the token budget, without exposing provider spend. The MCP limit error links to
  that page. Paid tiers do not have a separate monthly message cap; Taster retains its message cap.

Both counters are calendar-month, UTC. `app.billing_usage_events` is the ledger, and enforcement is
one atomic `INSERT … WHERE count < limit`, so two calls at the boundary cannot both pass.

Osmium is an assigned membership, not a public checkout option. Granting it immediately cancels an
active Stripe subscription before saving the membership, so future renewals stop. Stripe webhooks
cannot replace an active Osmium membership. Administrators can receive Osmium the same way as any
other user.

## Paying

`GET /account/billing` on the API is the pay surface: it shows the available tiers, starts a Stripe
Checkout, and offers a plan change or cancellation to anyone already paying. Osmium members see a
distinct complimentary membership card. `GET /billing` redirects to this canonical page. Signed-out
visitors go through hosted login first.

- `POST /billing/checkout` — starts a monthly `mode=subscription` Checkout for Core, Rhodium, or
  Iridium.
- `POST /billing/change` — changes an existing subscription to an available paid tier. AI is no
  longer offered.
- `POST /billing/cancel` — sets `cancel_at_period_end`; access continues until the period ends.
- `POST /webhooks/stripe/billing` — the writer of Stripe subscription state. It verifies
  `Stripe-Signature` against the raw body, and applies `customer.subscription.created`,
  `updated` and `deleted`. A `5xx` makes Stripe retry; the upsert makes a repeat safe.

The subscription carries `metadata.user_id`, `metadata.tier` and `metadata.founding`, which is what
the webhook uses to know whose account to write. Stripe state is one row per person: a new
subscription overwrites the old one, so access can never come from a stale row. Osmium assignment
is tracked separately and takes precedence over that row.

Operators assign Osmium through the billing commands, which record the granting and revoking user
and cancel an active Stripe plan on grant:

```bash
just billing grant member@example.com operator@example.com
just billing revoke member@example.com operator@example.com
```

## Configuration

| Variable                        | Meaning                                                |
| ------------------------------- | ------------------------------------------------------ |
| `STRIPE_SECRET_KEY`             | Stripe API key. No key means billing endpoints 503.    |
| `STRIPE_API_BASE_URL`           | Local Stripe fake, development only.                   |
| `BILLING_STRIPE_WEBHOOK_SECRET` | Signing secret for `/webhooks/stripe/billing`.         |
| `BILLING_TASTER_CHAT_MESSAGES`  | Taster monthly conversation cap.                       |
| `BILLING_TASTER_SKILL_CALLS`    | Taster monthly skill-call volume. Paid tiers uncapped. |

Stripe prices are created ad hoc per Checkout (`price_data`), so no price IDs need to be seeded for
a new environment. Register the webhook endpoint in the Stripe dashboard and put its signing secret
in `BILLING_STRIPE_WEBHOOK_SECRET` (or reuse `STRIPE_WEBHOOK_SECRET`).

## Rules for changes

- Change a price or token allowance only against the plan sheet, and change it here (and in
  `TIER_PRICES_PENCE` / `DEFAULT_BILLING_CONFIG`) in the
  same commit. Never infer a price from a Stripe dashboard value at runtime.
- Never let a cancel, a lapse, or a failed payment keep both a paid plan and access. `planFor` in
  `services/api/src/application/billing.ts` is the single answer to "what does this subscription
  grant now".
- Enforce a tier at the boundary where the work is started, not in the UI. The billing page shows
  usage; it does not decide access.
