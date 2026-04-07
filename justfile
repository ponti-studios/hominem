#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
WEB_DIR := ROOT_DIR / "apps" / "web"
TURBO := "bunx turbo"

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

db-setup environment="test" migrations-path="packages/core/db/migrations":
  #!/usr/bin/env bash
  goose_bin="$(go env GOPATH)/bin/goose"
  just goose-install
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL must be set"
    exit 1
  fi
  migrations_dir="{{ROOT_DIR}}/{{migrations-path}}"
  if [ ! -d "$migrations_dir" ]; then
    echo "Migrations directory not found: $migrations_dir"
    exit 1
  fi
  "$goose_bin" -dir "$migrations_dir" postgres "$DATABASE_URL" up

lint:
  {{TURBO}} run lint

typecheck:
  {{TURBO}} run typecheck

test-api:
  {{TURBO}} run test --filter=@hominem/api...

test-web:
  {{TURBO}} run test --filter=@hominem/web...

build-web:
  {{TURBO}} run build --filter=@hominem/web

build-api:
  {{TURBO}} run build --filter=@hominem/api

web-install-playwright:
  cd "{{WEB_DIR}}" && bunx playwright install --with-deps chromium

web-generate-icons source="{{WEB_DIR}}/public/logo.web.png":
  #!/usr/bin/env bash
  bun "{{ROOT_DIR}}/scripts/generate-web-icons.ts" --source "{{source}}"

web-test-e2e:
  {{TURBO}} run test:e2e --filter=@hominem/web

db-migrations-validate:
  #!/usr/bin/env bash
  goose_bin="$(go env GOPATH)/bin/goose"
  "$goose_bin" -dir "{{ROOT_DIR}}/packages/core/db/migrations" postgres "$DATABASE_URL" up
  "$goose_bin" -dir "{{ROOT_DIR}}/packages/core/db/migrations" postgres "$DATABASE_URL" up
  STATUS="$("$goose_bin" -dir "{{ROOT_DIR}}/packages/core/db/migrations" postgres "$DATABASE_URL" status)"
  echo "$STATUS"
  if echo "$STATUS" | grep -Ei 'Pending|pending'; then
    echo "Pending migrations remain after goose up"
    exit 1
  fi

docker-up:
  docker compose -f "{{ROOT_DIR}}/infra/compose/base.yml" -f "{{ROOT_DIR}}/infra/compose/dev.yml" up -d

docker-down:
  docker compose -f "{{ROOT_DIR}}/infra/compose/base.yml" -f "{{ROOT_DIR}}/infra/compose/dev.yml" down

docker-kill:
  docker compose -f "{{ROOT_DIR}}/infra/compose/base.yml" -f "{{ROOT_DIR}}/infra/compose/dev.yml" down --rmi all --volumes --remove-orphans

db-migrate:
  #!/usr/bin/env bash
  just goose-install
  goose -dir "{{ROOT_DIR}}/packages/core/db/migrations" postgres "$DATABASE_URL" up
  bun -F "@hominem/db" kysely-codegen

db-rollback:
  #!/usr/bin/env bash
  just goose-install
  goose -dir "{{ROOT_DIR}}/packages/core/db/migrations" postgres "$DATABASE_URL" down

db-status:
  #!/usr/bin/env bash
  just goose-install
  goose -dir "{{ROOT_DIR}}/packages/core/db/migrations" postgres "$DATABASE_URL" status

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

ci-build:
  {{TURBO}} run build

goose-install goose-version="v3.27.0":
  #!/usr/bin/env bash
  goose_bin="$(go env GOPATH)/bin/goose"
  if [ ! -x "$goose_bin" ]; then
    go install github.com/pressly/goose/v3/cmd/goose@{{goose-version}}
  fi
  export PATH="$(dirname "$goose_bin"):$PATH"
  if [ -n "${GITHUB_PATH:-}" ]; then
    echo "$(dirname "$goose_bin")" >> "$GITHUB_PATH"
  fi
