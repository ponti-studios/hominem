#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -f .eas-prod.local ]]; then
  set -a
  source .eas-prod.local
  set +a
fi

export APP_ENV=production
export SENTRY_ORG="${SENTRY_ORG:-ponti-studios}"
export SENTRY_PROJECT="${SENTRY_PROJECT:-omiro}"
: "${SENTRY_AUTH_TOKEN:?Set SENTRY_AUTH_TOKEN in .eas-prod.local or export it before building. Run 'pnpm eas:pull:prod' to fetch it.}"

node scripts/verify-release-identity.mjs
mkdir -p build
npx eas-cli build --platform ios --profile production --local --output build/prod-local.ipa
