#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
WEB_DIR := ROOT_DIR / "apps" / "web"
TURBO := "pnpm dlx turbo"

import 'justfiles/db.just'

lint:
    {{ TURBO }} run lint

typecheck:
    {{ TURBO }} run typecheck

check-web:
    {{ TURBO }} run lint typecheck test build --filter=@hominem/web

validate-web: check-web

check-api:
    {{ TURBO }} run lint typecheck test --filter=@hominem/api

validate-api: check-api

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
    #!/usr/bin/env bash
    lsof -ti:4040 | xargs kill -9 2>/dev/null || true
    {{ TURBO }} run dev --filter=@hominem/api

dev-web:
    {{ TURBO }} run dev --filter=@hominem/api --filter=@hominem/web

build:
    {{ TURBO }} run build

format:
    {{ TURBO }} run format

test:
    {{ TURBO }} run test

gh-pr-errors:
    ./.claude/skills/gh-pr-errors/scripts/check-last-gh-actions-errors.sh

MOBILE_DIR := ROOT_DIR / "apps" / "mobile"

mobile-test:
    cd "{{ MOBILE_DIR }}" && pnpm exec vitest run --config vitest.config.ts

mobile-test-watch:
    cd "{{ MOBILE_DIR }}" && pnpm exec vitest --config vitest.config.ts

mobile-typecheck:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo typecheck

mobile-start:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo start --platform ios

mobile-start-ios:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo start --ios

mobile-prebuild:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo prebuild --platform ios

mobile-run-ios:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo run:ios

mobile-doctor:
    cd "{{ MOBILE_DIR }}" && npx --yes expo-doctor

mobile-lint:
    cd "{{ MOBILE_DIR }}" && pnpm exec expo lint

mobile-check: mobile-typecheck mobile-test

validate-mobile: mobile-check
