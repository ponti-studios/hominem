#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
WEB_DIR := ROOT_DIR / "apps" / "web"
TURBO := "bunx turbo"
LOCAL_DATABASE_URL := "postgresql://postgres:postgres@127.0.0.1:5434/hominem"
LOCAL_TEST_DATABASE_URL := "postgresql://postgres:postgres@127.0.0.1:4433/hominem-test"

import 'justfiles/db.just'

setup install-flags="" build-packages="true" install-goose="false":
  #!/usr/bin/env bash
  NODE_ENV=development bun install --frozen-lockfile {{install-flags}}
  if [ "{{build-packages}}" = "true" ]; then
    {{TURBO}} run build --filter=@hominem/env --filter=@hominem/db --filter=@hominem/rpc --filter=@hominem/auth
  fi
  if [ "{{install-goose}}" = "true" ]; then
    just goose-install
  fi

start-compose-services compose-files services project-name="hominem" wait-timeout="120":
  #!/usr/bin/env bash
  read -r -a compose_files <<< "{{compose-files}}"
  read -r -a services_list <<< "{{services}}"
  compose_args=()
  for compose_file in "${compose_files[@]}"; do
    compose_args+=(-f "{{ROOT_DIR}}/$compose_file")
  done
  docker compose "${compose_args[@]}" \
    --project-name "{{project-name}}" \
    up -d --build --wait --wait-timeout "{{wait-timeout}}" \
    "${services_list[@]}"

lint:
  {{TURBO}} run lint

typecheck:
  {{TURBO}} run typecheck

check-web:
  {{TURBO}} run lint typecheck test build --filter=@hominem/web

check-api:
  {{TURBO}} run lint typecheck test --filter=@hominem/api

test-api:
  {{TURBO}} run test --filter=@hominem/api...

test-web:
  {{TURBO}} run test --filter=@hominem/web...

build-web:
  {{TURBO}} run build --filter=@hominem/web

build-api:
  {{TURBO}} run build --filter=@hominem/api

web-e2e-install:
  cd "{{WEB_DIR}}" && bunx playwright install --with-deps chromium

web-e2e-api-local:
  #!/usr/bin/env bash
  cd "{{ROOT_DIR}}" && just db-setup && cd "{{ROOT_DIR}}/services/api" && bun run start

web-e2e-api-ci:
  cd "{{ROOT_DIR}}/services/api" && bun run start

web-e2e-web-local:
  cd "{{WEB_DIR}}" && bun run build && bun run start

web-e2e-web-ci:
  cd "{{WEB_DIR}}" && bun run build && bun run start

web-e2e:
  cd "{{WEB_DIR}}" && bun run test:e2e

docker-up:
  docker compose -f "{{ROOT_DIR}}/infra/compose/base.yml" -f "{{ROOT_DIR}}/infra/compose/dev.yml" up -d

docker-down:
  docker compose -f "{{ROOT_DIR}}/infra/compose/base.yml" -f "{{ROOT_DIR}}/infra/compose/dev.yml" down

docker-kill:
  docker compose -f "{{ROOT_DIR}}/infra/compose/base.yml" -f "{{ROOT_DIR}}/infra/compose/dev.yml" down --rmi all --volumes --remove-orphans

dev:
  {{TURBO}} run dev

dev-api:
  #!/usr/bin/env bash
  lsof -ti:4040 | xargs kill -9 2>/dev/null || true
  {{TURBO}} run dev --filter=@hominem/api

dev-web:
  {{TURBO}} run dev --filter=@hominem/api --filter=@hominem/web

build:
  {{TURBO}} run build

format:
  {{TURBO}} run format

test:
  {{TURBO}} run test

gh-pr-errors:
  ./scripts/check-last-gh-actions-errors.sh

# Mobile (Expo)

MOBILE_DIR := ROOT_DIR / "apps" / "mobile"
JEST := MOBILE_DIR / "node_modules" / ".bin" / "jest"

mobile-test:
  cd "{{MOBILE_DIR}}" && {{JEST}}

mobile-test-watch:
  cd "{{MOBILE_DIR}}" && {{JEST}} --watch

mobile-typecheck:
  cd "{{MOBILE_DIR}}" && bunx tsc --noEmit

mobile-start:
  cd "{{MOBILE_DIR}}" && bun run expo start

mobile-start-ios:
  cd "{{MOBILE_DIR}}" && bun run expo start --ios

mobile-prebuild:
  cd "{{MOBILE_DIR}}" && bun run expo prebuild

mobile-run-ios:
  cd "{{MOBILE_DIR}}" && bun run expo run:ios

mobile-doctor:
  cd "{{MOBILE_DIR}}" && bun run expo doctor

mobile-lint:
  cd "{{MOBILE_DIR}}" && bun run expo lint

# Run all mobile checks
mobile-check: mobile-typecheck mobile-test
