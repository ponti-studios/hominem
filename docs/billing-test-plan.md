# Stripe billing test plan

This plan verifies Hominem's Stripe subscription catalog, Checkout, webhook
sync, plan changes, cancellation, and access rules. It covers local automated
checks and a real Stripe Test Mode Checkout. It does not authorize a live
payment or production Managed Payments activation.

The billing model and current product configuration are documented in
[`billing.md`](billing.md). Use the repository's
[`hominem-development` skill](../.agents/skills/hominem-development/SKILL.md)
to start the local stack and the
[`hominem-auth-e2e` skill](../.agents/skills/hominem-auth-e2e/SKILL.md) for
local test identities.

## Safety and test data

- Use Stripe **Test Mode** credentials and catalog only. Stripe Test Mode does
  not move real money.
- Keep `STRIPE_SECRET_KEY` and `BILLING_STRIPE_WEBHOOK_SECRET` in the ignored
  local `services/api/.env`. Never put them in a command argument, log, ticket,
  screenshot, or commit.
- Leave `STRIPE_API_BASE_URL` unset so subscription calls reach Stripe. The
  local Stripe fake is for Thames credit top-ups and does not implement this
  subscription flow.
- Use `test@lvh.me` for a single local test identity when it has no existing
  subscription. If it already has a plan, use a disposable
  `@test.hominem.dev` identity as described by `hominem-auth-e2e`.
- Use only Stripe's documented test card details. Do not enter a personal card
  or use a real person's Hominem account.
- Never complete a live Checkout during this plan. Production activation,
  tax registration, and legal/tax approval are separate release decisions.

## Required Test Mode setup

Before testing, confirm the sandbox contains active monthly GBP Prices with the
same lookup keys and price metadata used by the app:

| Plan                   | Lookup key                      |        Price | Required Price metadata                      |
| ---------------------- | ------------------------------- | -----------: | -------------------------------------------- |
| Core                   | `hominem_core_monthly`          |  £9.99/month | `tier=core`, `plan=monthly`                  |
| Rhodium                | `hominem_rhodium_monthly`       | £19.99/month | `tier=rhodium`, `plan=monthly`               |
| Iridium                | `hominem_iridium_monthly`       | £39.99/month | `tier=iridium`, `plan=monthly`               |
| Founding Core (legacy) | `hominem_founding_core_monthly` |  £7.99/month | `tier=core`, `plan=monthly`, `founding=true` |

All four products need the Managed Payments eligible tax code matching the
configured AIaaS cloud-based personal-use classification (`txcd_10105001`).
Each active catalog Price must also have `tax_behavior=inclusive`; replace
Prices to change this property and move the lookup keys, leaving the original
Prices untouched for existing subscriptions. Do not bulk-migrate subscribers.
Test and live catalogs are separate; do not use a Test Mode Price ID or key in
production.

Configure the local API with a Test Mode `sk_test` key, then start Stripe CLI
forwarding the subscription lifecycle events to the API's local webhook route.
For a fixed-port API on port 4040:

```bash
stripe listen \
  --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
  --forward-to http://localhost:4040/webhooks/stripe/billing
```

Put the listener's `whsec_...` value in the ignored API `.env` as
`BILLING_STRIPE_WEBHOOK_SECRET`, then restart the API so it loads the value.
For Portless or a branch-prefixed worktree, forward to that worktree's API
origin instead of port 4040. Verify the listener and API are both using the
same Test Mode sandbox.

## Tooling

The `just billing` recipes automate the local loop above and keep it
repeatable without dashboard work:

- `just billing stripe-setup` — the doctor. It fails with the exact fix for
  each missing piece: the CLI not installed or not paired (`stripe login`),
  no Test Mode key in the ignored API `.env` (a live key is refused
  outright), a configured `STRIPE_API_BASE_URL` fake, or a missing webhook
  secret.
- `just billing stripe-listen` — forwards the subscription lifecycle events
  to the local API's `/webhooks/stripe/billing`; set the printed `whsec_...`
  as `BILLING_STRIPE_WEBHOOK_SECRET` and restart the API.
- `just billing stripe-test <tier>` — seeds a disposable
  `stripe-<tier>-e2e@test.hominem.dev` account, signs in over the real OTP
  flow, starts the app's own checkout, completes Stripe's hosted page with
  the standard test card, then asserts the webhook-delivered subscription
  (tier, active status, catalog price, no founding seat) and the AI-token
  allowance the app itself reports. Exit 0 means every assertion passed.
- `just billing stripe-lapse` — the cancellation and lapse leg. Seeds a
  disposable account, starts a Core subscription under a Stripe Test Clock
  using the same metadata contract a checkout produces, cancels through the
  real `/billing/cancel`, then advances the clock past the period end and
  asserts the paid period was retained (no early downgrade, no resume action
  offered by the app) and the account fell back to Taster. Test clocks live
  under the `test_helpers` namespace in current API versions
  (`/v1/test_helpers/test_clocks`), not the `/v1/test_clocks` path older
  docs use.
- `just billing stripe-audit` — the read-only catalog audit. Fetches the
  account tax settings and every launch price with its expanded product over
  GETs only, then judges them against the same catalog table the app resolves
  subscriptions from. It prefers `STRIPE_LIVE_SECRET_KEY` in the ignored API
  `.env` — where the live key for the production audit is dropped by hand —
  and falls back to `STRIPE_SECRET_KEY`, so the same command proves the
  pipeline against the Test Mode catalog: there the live-mode finding fails
  by design (and the account-default one fails for as long as the test
  account's default isn't the AIaaS category), while every price and product
  finding must pass. It never prints key material and needs no local app or
  webhook listener.

The setup doctor runs inside `stripe-test` as well, so a run never starts
against a half-configured environment. The hosted-page automation prints
the page text and saves a screenshot when it cannot complete, so a Stripe
layout change is diagnosable from the run itself.

Two one-time prerequisites sit outside the recipes, because no recipe can
fix them mid-run:

- The hosted-page driver runs on `playwright-core`, which ships no browser.
  Install its headless shell once: `pnpm --filter @hominem/api exec
  playwright-core install chromium-headless-shell`.
- Complete Managed Payments onboarding in the Test Mode dashboard
  (Settings → Managed Payments). Checkout sessions request the
  merchant-of-record flow with `managed_payments[enabled]`, and Stripe
  accepts them even while onboarding is unfinished — the hosted page then
  never sends its confirm request, so the Pay click silently does nothing
  and no error names the cause. No API surface exposes the onboarding
  state, so the doctor cannot catch it; only the dashboard page can.

## Automated checks

Run the API and its dependents through the repository validation workflow
before accepting billing code changes. Stripe calls in unit/integration tests
must be mocked at the outbound HTTP boundary; tests must never require a real
Stripe key or send real payment requests.

### Catalog resolution

For each paid tier, confirm checkout and plan-change code resolves exactly one
active Price with the expected lookup key, GBP amount, monthly interval, and
metadata. Verify legacy Founding Core uses its £7.99 lookup key when a
grandfathered subscriber returns to Core.

For Core, Rhodium, Iridium, and Founding Core, test safe failure when the
lookup price is missing, inactive, duplicated, or has the wrong tier, amount,
currency, interval, plan metadata, or founding metadata. A failure must not
create an inline Price or silently choose a different tier.

### Checkout request

- A new eligible account can start a subscription Checkout for Core, Rhodium,
  and Iridium.
- Each session references the catalog Price ID and uses monthly subscription
  mode, the expected tier, user, founding flag, success URL, and cancel URL.
- Paid subscription sessions include the Managed Payments integration
  settings and supported Stripe API version. Thames top-up sessions do not
  include subscription-only Managed Payments parameters.
- A signed-out request returns through hosted login. A user who already has an
  active plan cannot accidentally create a second subscription.
- Cancelling Checkout returns to the billing page and does not grant paid
  access.

## Stripe Test Mode end-to-end matrix

### New subscription and webhook

1. Sign in as the local test identity and open `/account/billing`.
2. Start Core Checkout and verify the displayed product, recurring amount,
   currency, and billing interval before payment.
3. Use the Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC,
   and a UK test billing postcode. Confirm the tax line,
   total due, currency, and monthly renewal amount are internally consistent.
4. Complete the payment and confirm Stripe returns to `/billing/done`.
5. Confirm Stripe has a paid, complete Checkout Session and an active Core
   subscription with the expected customer, user, tier, and Founding metadata.
6. Confirm the subscription webhook is accepted and the local account page
   shows Core, the correct period end, and the expected status.
7. Deliver the same subscription event again and confirm the result is
   idempotent. Send an invalid signature and confirm it is rejected.

Run the same purchase checks for Rhodium and Iridium when validating each
catalog entry. A declined test card must leave the account without an active
paid entitlement.

### Plan changes

On one test subscriber, exercise Core → Rhodium → Iridium → Core. After each
change, verify Stripe uses the destination tier's existing catalog Price,
preserves subscription metadata, applies the configured proration behavior,
and emits an update that changes the local tier. Confirm no new Price or
Product was created as a side effect.

For a grandfathered Founding Core record, change away from Core and return;
verify the return uses the Founding Core Price and retains the £7.99 lock.
Do not grant a new founding seat to an ordinary test account.

### Cancellation and entitlement

- Cancel an active plan and verify Stripe sets `cancel_at_period_end`; the
  account keeps its paid tier through the current period.
- Verify the cancellation update is reflected locally. After the period ends
  or a Test Mode deletion event is applied, access falls back to Taster.
- Verify `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`,
  and `paused` records do not retain paid access under the documented billing
  rules.
- Confirm Taster blocks the configured message and MCP volume at the boundary,
  while paid tiers use their token allowance and have unlimited MCP calls.
- If testing Osmium assignment, verify granting it stops an active Stripe
  renewal and that a later Stripe webhook cannot override the membership.

### Managed Payments and tax

- Verify all public and legacy Test Mode catalog Prices are tax-inclusive and
  the advertised total remains £9.99 / £19.99 / £39.99 / £7.99 respectively.
  Check the tax breakdown for a UK test address and confirm tax is included in
  that total rather than added on top.
- Verify the Test Mode products have the intended AIaaS tax code and that
  Managed Payments accepts the subscription Checkout request.
- Check the checkout total and invoice tax amount for a UK address, and record
  the billing country, product, base amount, tax, total, and currency.
- Confirm the Test Mode checkout is sold through the configured Managed
  Payments flow, and verify the receipt and subscription in the Stripe
  sandbox.
- Confirm regular Thames top-ups still use their existing payment flow and
  are unaffected by subscription Managed Payments parameters.

Tax results in a sandbox are a functional check, not evidence of tax
registration or legal compliance. A tax adviser reviews cross-border coverage
after launch; that review is a follow-up, not a pre-launch gate. The
historical VAT-on-top invoice below used a tax-exclusive Price and does not
satisfy the inclusive-price test.

## Verified baseline

On 31 October 2026, a local Test Mode Core checkout completed successfully
using the then-current catalog Price and Stripe CLI webhook. Stripe reported a
complete, paid session and an active Core subscription. The Price was
tax-exclusive: the UK invoice showed £9.99 subtotal, £2.00 VAT, and £11.99
total. This verifies the Core purchase and subscription-created webhook path
only; it does not satisfy the inclusive-price matrix above.

## Release gate

Before enabling Managed Payments for live subscriptions, confirm the tested
code is deployed, production lookup-key Prices are active and correctly
classified, the production webhook receives and applies subscription events,
and every required end-to-end scenario above has an explicit result. `just
billing stripe-audit` with `STRIPE_LIVE_SECRET_KEY` set is how the catalog
half of this gate is confirmed; it exits nonzero on any failed finding. Do not
bulk-migrate existing subscribers or alter their current Prices as part of
this verification.
