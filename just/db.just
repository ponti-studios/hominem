migrate profile='':
    #!/usr/bin/env bash
    if [[ "{{ profile }}" == test ]]; then export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/app-test'; fi
    [[ -n "${DATABASE_URL:-}" ]] || { echo 'error: DATABASE_URL must be set' >&2; exit 1; }
    goose_bin="$(go env GOPATH)/bin/goose"
    if [[ ! -x "$goose_bin" ]]; then go install github.com/pressly/goose/v3/cmd/goose@v3.27.0; fi
    "$goose_bin" -dir "{{ justfile_directory() }}/packages/db/migrations" postgres "$DATABASE_URL" up

rollback profile='':
    #!/usr/bin/env bash
    if [[ "{{ profile }}" == test ]]; then export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/app-test'; fi
    [[ -n "${DATABASE_URL:-}" ]] || { echo 'error: DATABASE_URL must be set' >&2; exit 1; }
    goose_bin="$(go env GOPATH)/bin/goose"
    if [[ ! -x "$goose_bin" ]]; then go install github.com/pressly/goose/v3/cmd/goose@v3.27.0; fi
    "$goose_bin" -dir "{{ justfile_directory() }}/packages/db/migrations" postgres "$DATABASE_URL" down

status profile='':
    #!/usr/bin/env bash
    if [[ "{{ profile }}" == test ]]; then export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/app-test'; fi
    [[ -n "${DATABASE_URL:-}" ]] || { echo 'error: DATABASE_URL must be set' >&2; exit 1; }
    goose_bin="$(go env GOPATH)/bin/goose"
    if [[ ! -x "$goose_bin" ]]; then go install github.com/pressly/goose/v3/cmd/goose@v3.27.0; fi
    "$goose_bin" -dir "{{ justfile_directory() }}/packages/db/migrations" postgres "$DATABASE_URL" status

validate profile='':
    just db migrate "{{ profile }}"
    just db migrate "{{ profile }}"
    ! just db status "{{ profile }}" | grep -Eiq pending

codegen:
    #!/usr/bin/env bash
    [[ -n "${DATABASE_URL:-}" ]] || { echo 'error: DATABASE_URL must be set' >&2; exit 1; }
    cd "{{ justfile_directory() }}/packages/db"
    pnpm exec kysely-codegen --camel-case --date-parser string --type-mapping '{"timestamp":"ColumnType<string, Date | string, Date | string>","timestamptz":"ColumnType<string, Date | string, Date | string>","date":"ColumnType<string, Date | string, Date | string>"}' --out-file ./src/types/database.ts
    pnpm exec oxfmt ./src/types/database.ts --write
