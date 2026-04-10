MIGRATIONS_DIR := ROOT_DIR / "packages" / "core" / "db" / "migrations"

goose-install goose-version="v3.27.0":
    #!/usr/bin/env bash
    goose_bin="$(go env GOPATH)/bin/goose"
    if [ ! -x "$goose_bin" ]; then
      go install github.com/pressly/goose/v3/cmd/goose@{{ goose-version }}
    fi
    export PATH="$(dirname "$goose_bin"):$PATH"
    if [ -n "${GITHUB_PATH:-}" ]; then
      echo "$(dirname "$goose_bin")" >> "$GITHUB_PATH"
    fi

db-setup environment="test" migrations-path="packages/core/db/migrations":
    #!/usr/bin/env bash
    goose_bin="$(go env GOPATH)/bin/goose"
    just goose-install
    if [ -z "${DATABASE_URL:-}" ]; then
      if [ "{{ environment }}" = "test" ]; then
        DATABASE_URL="{{ LOCAL_TEST_DATABASE_URL }}"
      else
        echo "DATABASE_URL must be set"
        exit 1
      fi
    fi
    migrations_dir="{{ ROOT_DIR }}/{{ migrations-path }}"
    if [ ! -d "$migrations_dir" ]; then
      echo "Migrations directory not found: $migrations_dir"
      exit 1
    fi
    "$goose_bin" -dir "$migrations_dir" postgres "$DATABASE_URL" up

db-migrate:
    #!/usr/bin/env bash
    just goose-install
    DATABASE_URL="${DATABASE_URL:-{{ LOCAL_DATABASE_URL }}}"
    goose -dir "{{ MIGRATIONS_DIR }}" postgres "$DATABASE_URL" up
    pnpm --filter "@hominem/db" exec kysely-codegen

db-rollback:
    #!/usr/bin/env bash
    just goose-install
    DATABASE_URL="${DATABASE_URL:-{{ LOCAL_DATABASE_URL }}}"
    goose -dir "{{ MIGRATIONS_DIR }}" postgres "$DATABASE_URL" down

db-status:
    #!/usr/bin/env bash
    just goose-install
    DATABASE_URL="${DATABASE_URL:-{{ LOCAL_DATABASE_URL }}}"
    goose -dir "{{ MIGRATIONS_DIR }}" postgres "$DATABASE_URL" status

db-migrations-validate:
    #!/usr/bin/env bash
    goose_bin="$(go env GOPATH)/bin/goose"
    DATABASE_URL="${DATABASE_URL:-{{ LOCAL_DATABASE_URL }}}"
    "$goose_bin" -dir "{{ MIGRATIONS_DIR }}" postgres "$DATABASE_URL" up
    "$goose_bin" -dir "{{ MIGRATIONS_DIR }}" postgres "$DATABASE_URL" up
    STATUS="$($goose_bin -dir "{{ MIGRATIONS_DIR }}" postgres "$DATABASE_URL" status)"
    echo "$STATUS"
    if echo "$STATUS" | grep -Ei 'Pending|pending'; then
      echo "Pending migrations remain after goose up"
      exit 1
    fi
