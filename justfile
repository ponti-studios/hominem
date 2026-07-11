#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
UI_DIR := ROOT_DIR / "packages" / "platform" / "ui"
TURBO := "pnpm exec turbo"
TURBO_DEV := "pnpm exec turbo run dev --ui stream"

import 'justfiles/db.just'
import 'justfiles/promptfoo.just'
import 'justfiles/mobile.just'

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
    {{ TURBO }} format lint build test --force

dev:
    {{ TURBO_DEV }}

dev-api:
    {{ TURBO_DEV }} --filter=@hominem/api

storybook:
    cd "{{ UI_DIR }}" && pnpm exec storybook dev -p 6006

api:
    #!/usr/bin/env bash
    if [[ "$1" == "--prod" ]]; then
        {{ TURBO }} run start --filter=@hominem/api
    else
        {{ TURBO_DEV }} --filter=@hominem/api
    fi
