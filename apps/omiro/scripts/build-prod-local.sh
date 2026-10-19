#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# The IPA must come from committed source. Tracked changes would be built into the
# artifact without any commit to trace it back to.
if [[ "${OMIRO_ALLOW_DIRTY:-}" != 1 ]] && ! git diff --quiet HEAD --; then
  echo "Refusing to build a production IPA with uncommitted changes to tracked files:" >&2
  git status --short --untracked-files=no >&2
  echo "Commit or stash them, or set OMIRO_ALLOW_DIRTY=1 to build anyway." >&2
  exit 1
fi
echo "Building production IPA from $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"

if [[ -f .eas-prod.local ]]; then
  set -a
  source .eas-prod.local
  set +a
fi

export APP_ENV=production
: "${EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN:?Set EXPO_PUBLIC_NEWRELIC_IOS_APP_TOKEN in .eas-prod.local or export it before building.}"
: "${NEWRELIC_USER_API_KEY:?Set NEWRELIC_USER_API_KEY in .eas-prod.local or export it before building for source-map uploads.}"

node scripts/verify-release-identity.mjs
mkdir -p build
npx eas-cli build --platform ios --profile production --local --output build/prod-local.ipa
