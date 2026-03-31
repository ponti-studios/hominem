SHELL := /bin/bash

ifneq (,$(wildcard .env))
include .env
export
endif

DOCKER_COMPOSE := docker compose
DOCKER_DEV := $(DOCKER_COMPOSE) -f infra/docker/compose/base.yml -f infra/docker/compose/dev.yml
DOCKER_FULL := $(DOCKER_COMPOSE) -f infra/docker/compose/base.yml -f infra/docker/compose/dev.yml -f infra/docker/compose/observability.yml
DB_BUN := bun run --filter @hominem/db
MOBILE_BUN := bun run --filter @hominem/mobile
MOBILE_DIR := apps/mobile
DB_DEV = DATABASE_URL="$(DEV_DATABASE_URL)" $(DB_BUN)
DB_TEST = DATABASE_URL="$(TEST_DATABASE_URL)" $(DB_BUN)

DEV_DATABASE_URL ?= postgres://postgres:postgres@localhost:5434/hominem
TEST_DATABASE_URL ?= postgres://postgres:postgres@localhost:4433/hominem-test

.PHONY: help install dev build test lint format duplication typecheck-native
.PHONY: infra-up infra-down infra-reset infra-status
.PHONY: docker-up docker-down
.PHONY: db-up db-up-test db-down db-down-test db-status db-status-test
.PHONY: db-reset-dev db-reset-test db-verify-fresh
.PHONY: mobile.dev mobile.lint mobile.format mobile.test mobile.typecheck
.PHONY: mobile.e2e.build mobile.e2e.smoke mobile.e2e.smoke.ci
.PHONY: mobile.check-config mobile.check-config.preview mobile.check-config.production mobile.check-profiles
.PHONY: mobile.rc mobile.rc.smoke mobile.release
.PHONY: mobile.ota.verify.preview mobile.ota.verify.production mobile.ota.publish.preview
.PHONY: mobile.release.build.production mobile.release.submit.production

help:
	@echo ""
	@echo "Core:"
	@echo "  make install | dev | build | test | lint | format | duplication"
	@echo ""
	@echo "Mobile:"
	@echo "  make mobile.dev | mobile.lint | mobile.format | mobile.test | mobile.typecheck"
	@echo "  make mobile.e2e.build | mobile.e2e.smoke | mobile.e2e.smoke.ci"
	@echo "  make mobile.check-config | mobile.check-config.preview | mobile.check-config.production"
	@echo "  make mobile.check-profiles | mobile.rc | mobile.rc.smoke | mobile.release"
	@echo "  make mobile.ota.verify.preview | mobile.ota.verify.production | mobile.ota.publish.preview"
	@echo "  make mobile.release.build.production | mobile.release.submit.production"
	@echo ""
	@echo "Infra:"
	@echo "  make infra-up | infra-down | infra-reset | infra-status"
	@echo "  make docker-up | docker-down"
	@echo ""
	@echo "Database:"
	@echo "  make db-up | db-up-test | db-down | db-down-test | db-status | db-status-test"
	@echo "  make db-reset-dev | db-reset-test | db-verify-fresh"

install:
	bun install

dev:
	bun run dev

build:
	bun run build

test:
	bun run test

format:
	bun run format

duplication:
	bun run ./scripts/check-duplication.ts

typecheck-native:
	bun run typecheck:native

lint:
	bunx turbo run lint
	bun run typecheck:native
	bun run ./scripts/check-duplication.ts

mobile.dev:
	$(MOBILE_BUN) start

mobile.lint:
	$(MOBILE_BUN) lint

mobile.format:
	$(MOBILE_BUN) format

mobile.test:
	$(MOBILE_BUN) test

mobile.typecheck:
	$(MOBILE_BUN) typecheck

mobile.e2e.build:
	$(MOBILE_BUN) test:e2e:build

mobile.e2e.smoke:
	$(MOBILE_BUN) test:e2e:smoke

mobile.e2e.smoke.ci:
	$(MOBILE_BUN) test:e2e:smoke:ci

mobile.check-config:
	$(MOBILE_BUN) check:expo-config

mobile.check-config.preview:
	cd $(MOBILE_DIR) && eas env:exec preview "APP_VARIANT=preview EXPO_NO_DOTENV=1 EXPO_PUBLIC_E2E_TESTING=false bash scripts/check-expo-config.sh"

mobile.check-config.production:
	cd $(MOBILE_DIR) && eas env:exec production "APP_VARIANT=production EXPO_NO_DOTENV=1 EXPO_PUBLIC_E2E_TESTING=false bash scripts/check-expo-config.sh"

mobile.check-profiles:
	$(MOBILE_BUN) verify:eas-profiles

mobile.ota.verify.preview:
	cd $(MOBILE_DIR) && eas env:exec preview "bash scripts/check-release-env.sh preview"

mobile.ota.verify.production:
	cd $(MOBILE_DIR) && eas env:exec production "bash scripts/check-release-env.sh production"

mobile.rc: mobile.lint mobile.typecheck mobile.test mobile.check-profiles mobile.check-config.preview mobile.ota.verify.preview

mobile.rc.smoke: mobile.rc mobile.e2e.build mobile.e2e.smoke.ci

mobile.release: mobile.lint mobile.typecheck mobile.test mobile.check-profiles mobile.check-config.production mobile.ota.verify.production

mobile.ota.publish.preview:
	cd $(MOBILE_DIR) && APP_VARIANT=preview EXPO_NO_DOTENV=1 EXPO_PUBLIC_E2E_TESTING=false eas update --auto --platform ios --branch preview --clear-cache --non-interactive --environment preview

mobile.release.build.production:
	cd $(MOBILE_DIR) && APP_VARIANT=production EXPO_NO_DOTENV=1 EXPO_PUBLIC_E2E_TESTING=false eas build --profile production --platform ios --non-interactive

mobile.release.submit.production:
	cd $(MOBILE_DIR) && eas submit --profile production --platform ios --non-interactive --latest

infra-up:
	$(DOCKER_DEV) up -d redis db test-db

infra-down:
	$(DOCKER_DEV) down

infra-reset:
	$(DOCKER_DEV) down -v
	$(MAKE) infra-up

infra-status:
	$(DOCKER_DEV) ps

docker-up:
	$(DOCKER_FULL) up -d

docker-down:
	$(DOCKER_FULL) down -v

db-up:
	$(DB_DEV) goose:up

db-up-test:
	$(DB_TEST) goose:up

db-down:
	$(DB_DEV) goose:down

db-down-test:
	$(DB_TEST) goose:down

db-status:
	$(DB_DEV) goose:status

db-status-test:
	$(DB_TEST) goose:status

db-reset-dev:
	$(DB_DEV) goose:reset
	$(DB_DEV) goose:up

db-reset-test:
	$(DB_TEST) goose:reset
	$(DB_TEST) goose:up

db-verify-fresh: db-reset-test
	@STATUS="$$(DATABASE_URL='$(TEST_DATABASE_URL)' $(DB_BUN) goose:status)"; \
		echo "$$STATUS"; \
		if echo "$$STATUS" | grep -Ei 'Pending|pending'; then \
		  echo "Pending migrations remain after goose up"; \
		  exit 1; \
		fi
