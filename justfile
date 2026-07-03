#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
UI_DIR := ROOT_DIR / "packages" / "platform" / "ui"
TURBO := "pnpm exec turbo"
TURBO_DEV := "pnpm exec turbo run dev --ui stream"
OMIRO_RUNTIME_VERSION := "ios-r1"

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
    {{ TURBO_DEV }}

dev-api:
    {{ TURBO_DEV }} --filter=@hominem/api

storybook:
    cd "{{ UI_DIR }}" && pnpm exec storybook dev -p 6006

OMIRO_DIR := ROOT_DIR / "apps" / "omiro"

mobile-test:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest run --config vitest.config.ts

mobile-test-watch:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest --config vitest.config.ts

start-ios:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo start --ios

mobile-prebuild-development:
    cd "{{ OMIRO_DIR }}" && APP_ENV="development" OMIRO_DEV_CLIENT="true" pnpm exec expo prebuild --platform ios --clean

mobile-prebuild-production runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && APP_ENV="production" OMIRO_RELEASE_CHANNEL="production" EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec expo prebuild --platform ios --clean

mobile-dev:
    cd "{{ OMIRO_DIR }}" && APP_ENV="development" OMIRO_DEV_CLIENT="true" pnpm exec expo run:ios

mobile-e2e:
    cd "{{ OMIRO_DIR }}" && APP_ENV="development" EXPO_PUBLIC_E2E_TESTING="true" OMIRO_DEV_CLIENT="false" pnpm exec expo run:ios

mobile-build-staging runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas build --platform ios --profile staging

mobile-build-production runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas build --platform ios --profile production

mobile-update-staging runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && APP_ENV="production" OMIRO_RELEASE_CHANNEL="staging" EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas update --channel staging

mobile-update-production runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && APP_ENV="production" OMIRO_RELEASE_CHANNEL="production" EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas update --channel production

mobile-doctor:
    cd "{{ OMIRO_DIR }}" && npx --yes expo-doctor

mobile-lint:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo lint

api:
    #!/usr/bin/env bash
    if [[ "$1" == "--prod" ]]; then
        {{ TURBO }} run start --filter=@hominem/api
    else
        {{ TURBO_DEV }} --filter=@hominem/api
    fi
