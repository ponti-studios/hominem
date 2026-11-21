grant email by_email:
    pnpm --filter @hominem/api membership grant --email {{ quote(email) }} --by {{ quote(by_email) }}

revoke email by_email:
    pnpm --filter @hominem/api membership revoke --email {{ quote(email) }} --by {{ quote(by_email) }}

# Doctor for local Stripe verification: everything stripe-listen and stripe-test need before they can run.
stripe-setup:
    pnpm --filter @hominem/api stripe-setup

# Forward billing webhooks from Stripe to the local API. Leave it running in its own terminal,
# set the printed whsec_... as BILLING_STRIPE_WEBHOOK_SECRET in services/api/.env, restart the API.
stripe-listen:
    #!/usr/bin/env bash
    command -v stripe >/dev/null || {
        echo 'error: stripe CLI not installed — brew install stripe/stripe-cli/stripe' >&2
        exit 1
    }
    echo '> Forwarding billing webhooks to https://api.lvh.me/webhooks/stripe/billing'
    echo '> Set the printed whsec_... as BILLING_STRIPE_WEBHOOK_SECRET in services/api/.env, then restart the API.'
    stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
        --forward-to https://api.lvh.me/webhooks/stripe/billing

# One-command hosted Test Mode checkout verification: seeds a disposable account, pays with the
# test card, then asserts the webhook-delivered entitlement and allowance. Requires stripe-setup
# green and stripe-listen running. Tier: core, rhodium or iridium.
stripe-test tier:
    #!/usr/bin/env bash
    # Node's fetch does not read the macOS keychain, so hand it the portless CA when present.
    if [ -f "$HOME/.portless/ca.pem" ]; then
        export NODE_EXTRA_CA_CERTS="$HOME/.portless/ca.pem"
    fi
    pnpm --filter @hominem/api stripe-test {{ tier }}

# One-command Test Clock lapse verification: seeds a disposable account, starts a Core
# subscription under a Stripe Test Clock, cancels through the real app, then advances the clock
# past the period end and asserts the fallback to Taster. Requires stripe-setup green and
# stripe-listen running.
stripe-lapse:
    #!/usr/bin/env bash
    # Node's fetch does not read the macOS keychain, so hand it the portless CA when present.
    if [ -f "$HOME/.portless/ca.pem" ]; then
        export NODE_EXTRA_CA_CERTS="$HOME/.portless/ca.pem"
    fi
    pnpm --filter @hominem/api stripe-lapse
