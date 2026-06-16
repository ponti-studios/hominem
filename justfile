#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
UI_DIR := ROOT_DIR / "packages" / "platform" / "ui"
TURBO := "pnpm exec turbo"
LOCAL_DATABASE_URL := "postgresql://postgres:postgres@127.0.0.1:5434/hominem"
LOCAL_TEST_DATABASE_URL := "postgresql://postgres:postgres@127.0.0.1:4433/app-test"

import 'justfiles/db.just'

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
    {{ TURBO }} run dev

dev-api:
    {{ TURBO }} run dev --filter=@hominem/api

storybook:
    cd "{{ UI_DIR }}" && pnpm exec storybook dev -p 6006

MOBILE_DIR := ROOT_DIR / "apps" / "mobile"

mobile-test:
    cd "{{ MOBILE_DIR }}" && pnpm exec vitest run --config vitest.config.ts

mobile-test-watch:
    cd "{{ MOBILE_DIR }}" && pnpm exec vitest --config vitest.config.ts

start-ios:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo start --ios

mobile-prebuild:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo prebuild --platform ios --clean

run-ios variant="dev":
    cd "{{ MOBILE_DIR }}" && APP_VARIANT="{{ variant }}" pnpm exec expo run:ios

mobile-doctor:
    cd "{{ MOBILE_DIR }}" && npx --yes expo-doctor

mobile-lint:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo lint

api:
    #!/usr/bin/env bash
    if [[ "$1" == "--prod" ]]; then
        {{ TURBO }} run start --filter=@hominem/api
    else
        {{ TURBO }} run dev --filter=@hominem/api
    fi
