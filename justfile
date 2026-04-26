#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
WEB_DIR := ROOT_DIR / "apps" / "web"
TURBO := "pnpm dlx turbo"
LOCAL_DATABASE_URL := "postgresql://postgres:postgres@127.0.0.1:5434/hominem"
LOCAL_TEST_DATABASE_URL := "postgresql://postgres:postgres@127.0.0.1:4433/hominem-test"

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

test-web:
    {{ TURBO }} run test --filter=@hominem/web...

build-web:
    {{ TURBO }} run build --filter=@hominem/web

build-api:
    {{ TURBO }} run build --filter=@hominem/api

web-e2e-install:
    cd "{{ WEB_DIR }}" && pnpm dlx playwright install --with-deps chromium

dev:
    {{ TURBO }} run dev

dev-api:
    {{ TURBO }} run dev --filter=@hominem/api

dev-web:
    {{ TURBO }} run dev --filter=@hominem/api --filter=@hominem/web

MOBILE_DIR := ROOT_DIR / "apps" / "mobile"

mobile-test:
    cd "{{ MOBILE_DIR }}" && pnpm exec vitest run --config vitest.config.ts

mobile-test-watch:
    cd "{{ MOBILE_DIR }}" && pnpm exec vitest --config vitest.config.ts

start-ios:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo start --ios

mobile-prebuild:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo prebuild --platform ios

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
