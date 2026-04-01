SHELL := /bin/bash

ifneq (,$(wildcard .env))
include .env
export
endif

DOCKER_COMPOSE := docker compose
DOCKER_DEV := $(DOCKER_COMPOSE) -f infra/docker/compose/base.yml -f infra/docker/compose/dev.yml
DOCKER_OBSERVABILITY := $(DOCKER_COMPOSE) -f infra/docker/compose/observability.yml
DOCKER_FULL := $(DOCKER_COMPOSE) -f infra/docker/compose/base.yml -f infra/docker/compose/dev.yml -f infra/docker/compose/observability.yml

DEV_DATABASE_URL ?= postgres://postgres:postgres@localhost:5434/hominem
TEST_DATABASE_URL ?= postgres://postgres:postgres@localhost:4433/hominem-test
GOOSE_MIGRATIONS_DIR ?= $(CURDIR)/packages/db/migrations
CLICKHOUSE_USER ?= default
CLICKHOUSE_PASSWORD ?= default

.PHONY: help install dev build test lint format duplication typecheck-native
.PHONY: infra-up infra-down infra-reset infra-status
.PHONY: docker-up docker-up-observability docker-up-full docker-down
.PHONY: obs-up obs-down obs-smoke obs-status
.PHONY: db-up db-up-test db-down db-down-test db-status db-status-test
.PHONY: db-reset-dev db-reset-test db-verify-fresh
.PHONY: db-v1-verify-fresh db-v1-verify-relational db-v1-verify-registry db-v1-verify-rls
.PHONY: db-v1-verify-tags db-v1-verify-rollback db-v1-verify-reset db-v1-verify-tag-performance db-v1-verify-all

help:
	@echo ""
	@echo "Core:"
	@echo "  make install | dev | build | test | lint | format | duplication"
	@echo ""
	@echo "Infra:"
	@echo "  make infra-up | infra-down | infra-reset | infra-status"
	@echo "  make obs-up | obs-smoke | obs-down"
	@echo "  make docker-up-observability | docker-up-full | docker-down"
	@echo ""
	@echo "Database:"
	@echo "  make db-up | db-up-test | db-down | db-down-test | db-status | db-status-test"
	@echo "  make db-reset-dev | db-reset-test | db-verify-fresh | db-v1-verify-all"

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

infra-up:
	$(DOCKER_DEV) up -d redis db

infra-down:
	$(DOCKER_DEV) down

infra-reset:
	$(DOCKER_DEV) down -v
	$(MAKE) infra-up

infra-status:
	$(DOCKER_DEV) ps

docker-up: infra-up

docker-up-observability:
	$(MAKE) obs-up

obs-up:
	CLICKHOUSE_USER="$(CLICKHOUSE_USER)" CLICKHOUSE_PASSWORD="$(CLICKHOUSE_PASSWORD)" $(DOCKER_OBSERVABILITY) up -d --wait

obs-status:
	$(DOCKER_OBSERVABILITY) ps

obs-smoke:
	@set -euo pipefail; \
	source scripts/_lib.sh; \
	: "$${CLICKHOUSE_USER:=default}"; \
	: "$${CLICKHOUSE_PASSWORD:=default}"; \
	export CLICKHOUSE_USER CLICKHOUSE_PASSWORD; \
	ensure_obs_stack; \
	trace_suffix="$$(openssl rand -hex 4)"; \
	service_name="hominem-observability-smoke-$${trace_suffix}"; \
	span_name="smoke-span-$${trace_suffix}"; \
	export OTEL_LOGS_EXPORTER=none; \
	echo "==> Sending smoke trace to the collector..."; \
	SERVICE_NAME="$${service_name}" SPAN_NAME="$${span_name}" bun --eval 'import { trace } from "@opentelemetry/api"; import { initTelemetry } from "@hominem/telemetry/node"; const telemetry = initTelemetry({ serviceName: process.env.SERVICE_NAME, environment: "local", otlpEndpoint: "http://localhost:4318", otlpProtocol: "http/protobuf" }); const tracer = trace.getTracer("smoke"); const span = tracer.startSpan(process.env.SPAN_NAME); span.setAttribute("smoke", "true"); span.end(); await telemetry.forceFlush(); await telemetry.shutdown();' >/dev/null; \
	echo "==> Waiting for trace to land in ClickHouse..."; \
	query="SELECT count() FROM default.otel_traces WHERE ServiceName = '$${service_name}' AND SpanName = '$${span_name}' FORMAT TSVRaw"; \
	count=""; \
	for _ in $$(seq 1 24); do \
	  count="$$(curl -fsS -u "$${CLICKHOUSE_USER}:$${CLICKHOUSE_PASSWORD}" --get --data-urlencode "query=$${query}" http://localhost:8123/ 2>/dev/null || true)"; \
	  if [ "$${count}" = "1" ]; then \
	    echo "Smoke trace verified in ClickHouse."; \
	    exit 0; \
	  fi; \
	  sleep 2; \
	done; \
	echo "ERROR: Smoke trace did not appear in ClickHouse within 48s." >&2; \
	exit 1


obs-down:
	$(DOCKER_OBSERVABILITY) down -v

docker-up-full:
	$(DOCKER_FULL) up -d

docker-down:
	$(DOCKER_FULL) down -v

db-up:
	DATABASE_URL="$(DEV_DATABASE_URL)" bash ./scripts/run-goose.sh up

db-up-test:
	DATABASE_URL="$(TEST_DATABASE_URL)" bash ./scripts/run-goose.sh up

db-down:
	DATABASE_URL="$(DEV_DATABASE_URL)" bash ./scripts/run-goose.sh down

db-down-test:
	DATABASE_URL="$(TEST_DATABASE_URL)" bash ./scripts/run-goose.sh down

db-status:
	DATABASE_URL="$(DEV_DATABASE_URL)" bash ./scripts/run-goose.sh status

db-status-test:
	DATABASE_URL="$(TEST_DATABASE_URL)" bash ./scripts/run-goose.sh status

db-reset-dev:
	DATABASE_URL="$(DEV_DATABASE_URL)" bash ./scripts/reset-database.sh
	DATABASE_URL="$(DEV_DATABASE_URL)" bash ./scripts/run-goose.sh up

db-reset-test:
	DATABASE_URL="$(TEST_DATABASE_URL)" bash ./scripts/reset-database.sh
	DATABASE_URL="$(TEST_DATABASE_URL)" bash ./scripts/run-goose.sh up

db-verify-fresh:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-goose-fresh-db.sh

db-v1-verify-fresh:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-goose-fresh-db.sh

db-v1-verify-relational:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-relational.sh

db-v1-verify-registry:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-registry.sh

db-v1-verify-rls:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-rls.sh

db-v1-verify-tags:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-tags.sh

db-v1-verify-rollback:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-rollback.sh

db-v1-verify-reset:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-reset.sh

db-v1-verify-tag-performance:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" GOOSE_MIGRATIONS_DIR="$(GOOSE_MIGRATIONS_DIR)" bash ./scripts/verify-v1-tag-performance.sh

db-v1-verify-all: db-v1-verify-fresh db-v1-verify-relational db-v1-verify-registry db-v1-verify-rls db-v1-verify-tags db-v1-verify-rollback db-v1-verify-reset db-v1-verify-tag-performance
