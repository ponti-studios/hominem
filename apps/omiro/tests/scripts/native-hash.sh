#!/usr/bin/env bash
# A fingerprint of everything that changes the native dev client: dependencies, config and local
# native modules. When it differs from the one stored in the installed app, the app must be rebuilt.
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_DIR"
{
  cat package.json ../../pnpm-lock.yaml
  for file in app.config.* app.json; do [[ -f "$file" ]] && cat "$file"; done
  for dir in modules plugins; do
    [[ -d "$dir" ]] || continue
    find "$dir" -type f \( -name '*.swift' -o -name '*.m' -o -name '*.h' -o -name '*.podspec' -o -name '*.json' -o -name '*.ts' -o -name '*.js' \) -not -path '*/node_modules/*' | sort | xargs cat
  done
} | shasum -a 256 | cut -d' ' -f1
