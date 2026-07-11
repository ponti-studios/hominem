#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
UI_DIR := ROOT_DIR / "packages" / "ui"
PNPM := 'env PNPM_HOME= PATH="$(dirname "$(mise which pnpm)"):$PATH" "$(mise which pnpm)"'
TURBO := 'env PNPM_HOME= PATH="$(dirname "$(mise which pnpm)"):$PATH" "$(mise which pnpm)" exec turbo'
TURBO_DEV := 'env PNPM_HOME= PATH="$(dirname "$(mise which pnpm)"):$PATH" "$(mise which pnpm)" exec turbo run dev --ui stream'

import 'justfiles/db.just'
import 'justfiles/promptfoo.just'
import 'justfiles/mobile.just'

setup:
    {{ PNPM }} install

lint:
    {{ TURBO }} run lint

typecheck:
    {{ TURBO }} run typecheck

build:
    {{ TURBO }} run build

format:
    {{ TURBO }} run format

test:
    {{ TURBO }} run test

test-api:
    {{ TURBO }} run test --filter=@hominem/api...

check:
    {{ TURBO }} run format lint build test --force

check-api:
    {{ TURBO }} run lint typecheck test --filter=@hominem/api... --force

dev:
    {{ TURBO_DEV }}

dev-api:
    {{ TURBO_DEV }} --filter=@hominem/api

dev-career:
    {{ TURBO_DEV }} --filter=@hominem/career

dev-finance:
    {{ TURBO_DEV }} --filter=@hominem/finance

dev-omiro:
    just mobile-dev

storybook:
    cd "{{ UI_DIR }}" && {{ PNPM }} exec storybook dev -p 6006

api:
    #!/usr/bin/env bash
    if [[ "$1" == "--prod" ]]; then
        {{ TURBO }} run start --filter=@hominem/api
    else
        {{ TURBO_DEV }} --filter=@hominem/api
    fi

mcp-install-claude:
    claude plugin marketplace add ./plugins
    claude plugin install hominem-mcp@hominem-plugins --scope local
