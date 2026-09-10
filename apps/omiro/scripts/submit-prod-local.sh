#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ipa_path="${1:-build/prod-local.ipa}"
if [[ ! -f "$ipa_path" ]]; then
  echo "IPA not found at '$ipa_path'. Run pnpm build:prod:local first or pass an explicit path." >&2
  exit 1
fi

export APP_ENV=production
node scripts/verify-release-identity.mjs
printf 'Submitting IPA: %s\n' "$ipa_path"
npx eas-cli submit --platform ios --profile production --path "$ipa_path"
