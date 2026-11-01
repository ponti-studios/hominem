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

Stripe billing resolves active catalog Prices by lookup key. Each resolved Price must match the
configured tier amount, GBP currency, monthly recurring interval, `tax_behavior=inclusive`, and
Price metadata (`tier` and `plan=monthly`; the legacy Founding Core Price also requires
`founding=true`). Missing, inactive, or mismatched catalog entries fail closed; billing never
creates an inline subscription Price.

| Offer                       | Lookup key                      | Price        | Price metadata                               |
| --------------------------- | ------------------------------- | ------------ | -------------------------------------------- |
| Core                        | `hominem_core_monthly`          | £9.99/month  | `tier=core`, `plan=monthly`                  |
| Rhodium                     | `hominem_rhodium_monthly`       | £19.99/month | `tier=rhodium`, `plan=monthly`               |
| Iridium                     | `hominem_iridium_monthly`       | £39.99/month | `tier=iridium`, `plan=monthly`               |
| Founding Core (legacy only) | `hominem_founding_core_monthly` | £7.99/month  | `tier=core`, `plan=monthly`, `founding=true` |

Live and Test Mode catalogs are separate. Create products and active monthly GBP Prices in each
mode with the same lookup keys and metadata, then configure the matching mode's API key. Existing
subscriptions retain their current Price until a member changes plans; a change resolves the new
tier's catalog Price and keeps the existing proration behavior. Do not bulk-migrate subscribers.
For advertised tax-inclusive prices, use replacement Prices rather than changing existing Price
objects: Stripe does not allow changing a Price's tax behavior after it is set. Move each lookup key
to the new inclusive Price and leave old Price objects active for existing subscriptions.

New paid subscription Checkouts use Stripe Managed Payments. The four active Hominem products use
the eligible “Artificial Intelligence as a Service (AIaaS) — Cloud Based — Personal Use” product
category, and the default category for new products is the same. The subscription Checkout request
sets `managed_payments[enabled]=true` and uses Stripe API version `2026-09-30.endive`; regular
Thames credit top-ups remain outside Managed Payments. Keep Managed Payments-only parameters out of
other Checkout flows, and don't pass parameters that Managed Payments controls (including
`automatic_tax`, `tax_id_collection`, or explicit payment method settings) to its sessions.

Stripe's Managed Payments dashboard setup is saved at the “Set up your checkout” stage. Finish
activation only after the app code with the Managed Payments Checkout request has been deployed.
The account's old `$40 a year`, `$5.44 a month`, `$80 a year`, `$8 a month`, and `Ponti & Co`
products were archived; archiving hides them from new purchases and retains their history.

For local real-Checkout testing, use a Stripe Test Mode `sk_test` key in the ignored API `.env`,
matching Test Mode catalog entries, and a webhook secret from Stripe CLI. Unset
`STRIPE_API_BASE_URL`, then forward subscription events to the worktree API:

```bash
stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
  --forward-to https://api.lvh.me/webhooks/stripe/billing
```

Set the emitted `whsec_...` value as `BILLING_STRIPE_WEBHOOK_SECRET`, sign in as `test@lvh.me`, and
complete Checkout with a Stripe test card. Verify the Checkout line item amount and the resulting
subscription tier/status, then exercise a tier change and cancellation. Never use a live key or
card for this test. The local fake supports Thames top-ups, not subscription billing.

Register the production webhook endpoint in Stripe and put its signing secret in
`BILLING_STRIPE_WEBHOOK_SECRET` (or reuse `STRIPE_WEBHOOK_SECRET`).

The full repeatable verification matrix, including checkout, tax, webhook, tier-change, and
cancellation scenarios, is in [`billing-test-plan.md`](billing-test-plan.md).

### Managed Payments tax-country gate

Paid checkout asks the customer for a billing country before creating a Stripe Checkout Session and
rejects countries outside the server-side allowlist in
`services/api/src/application/managed-payments-tax-countries.ts`. That list mirrors Stripe's
[Managed Payments tax-coverage list](https://docs.stripe.com/payments/managed-payments/tax-compliance)
and should be rechecked before release. Free registration is unchanged.

This pre-Checkout selection is not a hard restriction on the final tax location: Stripe Managed
Payments Checkout collects and updates the customer's billing address, and Stripe documents no
allowed-country parameter for billing addresses. The customer can change that address in hosted
Checkout. **Keep live Managed Payments activation blocked** until Stripe provides a hard pre-charge
restriction for the final billing country, or a new product/tax decision explicitly replaces this
gate. Do not treat an app-side country choice or a post-payment check as proof that unsupported
countries cannot be charged.

## Rules for changes

- Change a price or token allowance only against the plan sheet, and change it here (and in
  `TIER_PRICES_PENCE` / `DEFAULT_BILLING_CONFIG`) in the
  same commit. Never infer a price from a Stripe dashboard value at runtime.
- Never let a cancel, a lapse, or a failed payment keep both a paid plan and access. `planFor` in
  `services/api/src/application/billing.ts` is the single answer to "what does this subscription
  grant now".
- Enforce a tier at the boundary where the work is started, not in the UI. The billing page shows
  usage; it does not decide access.
