# Billing and paid tiers

Hominem offers two plans: free Taster and paid Core. Stripe takes the money and is the system of
record; the API holds the account state it enforces and never trusts a browser for it.

The prices are decided in the **"Hominem — Paid Tier Plan" sheet**. The monthly volume caps below
are the deployed configuration and can be changed from the environment without a rule change.

| Plan   | Price         | Skills                        | Monthly conversation |
| ------ | ------------- | ----------------------------- | -------------------- |
| Taster | £0            | capped by volume, all domains | 50 messages          |
| Core   | £9.99 / month | uncapped                      | 1,000 messages       |

AI and Founding Core are retired and are not available for new subscriptions or plan changes. The
existing Founding Core price lock remains supported for legacy records; no new founding seats are
issued. Legacy AI records retain their stored plan and 3,000-message allowance until they end. There
were no active app subscribers when these offers were retired.

## What a plan gates

A person's plan is derived from their `app.billing_subscriptions` row, never from the request:

- `active` or `trialing` **and** inside `current_period_end` → the paid plan (`founding` turns Core
  into Founding Core; a legacy AI record remains AI).
- `cancel_at_period_end` keeps access until the paid period ends.
- Anything else — `past_due`, `unpaid`, `canceled`, `incomplete`, `paused` — is Taster immediately.

A plan is blocked by **volume, never by domain**. Every plan can reach every skill; the difference is
how much can be used. The two counters are:

- `chat` — one row per Conversation message, counted at generation start
  (`services/api/src/chat/chat-generation-commands.ts`). Every plan has a finite cap, so uncapped
  conversation is impossible.
- `skill` — one row per MCP tool invocation (`services/api/src/mcp/server.ts`). Taster has a finite
  monthly volume; paid plans do not. The `/billing` page shows the current MCP tool-call count and
  cap, and the MCP limit error links to that page.

Both counters are calendar-month, UTC. `app.billing_usage_events` is the ledger, and enforcement is
one atomic `INSERT … WHERE count < limit`, so two calls at the boundary cannot both pass.

Accounts listed in `HOMINEM_ADMIN_EMAILS` receive unlimited app usage: message volume, MCP calls,
and the monthly AI spend cap are bypassed. Usage is still recorded and reported. The setting is a
comma-separated list of exact email addresses, matched case-insensitively; it does not accept domain
wildcards. Admin access does not create or cancel a Stripe subscription.

## Paying

`GET /billing` on the API is the pay surface: it shows Taster and Core, starts a Stripe Checkout, and
offers a plan change or cancellation to anyone already paying. Signed-out visitors go through the
hosted login first.

- `POST /billing/checkout` — starts a monthly `mode=subscription` Checkout for Core at £9.99.
- `POST /billing/change` — changes an existing subscription to Core. AI is no longer offered.
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
| `BILLING_TASTER_SKILL_CALLS`    | Taster monthly skill-call volume. Paid tiers uncapped. |
| `HOMINEM_ADMIN_EMAILS`          | Comma-separated exact email allowlist for admin access and unlimited app usage. |

The legacy `BILLING_AI_CHAT_MESSAGES` setting remains available for stored AI records. Stripe prices
are created ad hoc per Checkout (`price_data`), so no price IDs need to be seeded for a new
environment. Register the webhook endpoint in the Stripe dashboard and put its signing secret in
`BILLING_STRIPE_WEBHOOK_SECRET` (or reuse `STRIPE_WEBHOOK_SECRET`).

## Rules for changes

- Change a price only against the plan sheet, and change it here (and in `TIER_PRICES_PENCE`) in the
  same commit. Never infer a price from a Stripe dashboard value at runtime.
- Never let a cancel, a lapse, or a failed payment keep both a paid plan and access. `planFor` in
  `services/api/src/application/billing.ts` is the single answer to "what does this subscription
  grant now".
- Enforce a tier at the boundary where the work is started, not in the UI. The billing page shows
  usage; it does not decide access.
