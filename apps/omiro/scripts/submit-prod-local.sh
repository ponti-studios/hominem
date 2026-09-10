#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ipa_path=''
while IFS= read -r -d '' candidate; do
  if [[ -z "$ipa_path" || "$candidate" -nt "$ipa_path" ]]; then
    ipa_path="$candidate"
  fi
done < <(find . -type f -name '*.ipa' -not -path './node_modules/*' -print0)

if [[ -z "$ipa_path" ]]; then
  echo 'No IPA found. Run pnpm build:prod:local first.' >&2
  exit 1
fi

export APP_ENV=production
node scripts/verify-release-identity.mjs
printf 'Submitting IPA: %s\n' "$ipa_path"
pnpm exec eas submit --platform ios --profile production --path "$ipa_path"
