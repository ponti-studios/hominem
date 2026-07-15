# Hominem API

A Hono API with shared authentication, data access, and worker integrations.

## Quick Start

```bash
just setup
just dev api
```

## How To Think About The Commands

| Need                               | Run                         | When to use it                          |
| ---------------------------------- | --------------------------- | --------------------------------------- |
| Start local development            | `just dev api`              | Normal day-to-day API work              |
| Check the API                      | `just check api`            | Before commits and PRs                  |
| Run API tests                      | `just test api`             | Run the test profile and API test suite |
| Format API code                    | `just format write api`     | Apply formatting                        |
| Check formatting                   | `just format check api`     | Validate formatting without edits       |
| Run the auth middleware perf check | `pnpm perf:auth-middleware` | Inspect middleware performance          |

## Daily Workflow

For most API changes, the loop is simple:

1. Start with `just dev api`.
2. Run `just check api` before you stop.

## Workflow Guide

### Local Development

`just dev api` starts the API in watch mode through Turbo.

The API listens on `http://localhost:4040`.

### Testing

`just test api` supplies the checked-in test database and auth test profile. Do not run
the API test script directly against an ambient `DATABASE_URL`.

### Quality And Type Safety

`just check api` covers format checking, linting, typechecking, building, and tests.
Use `just lint fix api` or `just format write api` for the two source-modifying operations.

## Configuration Model

The important API files are:

- [package.json](package.json) for scripts.
- [src/index.ts](src/index.ts) for server startup.
- [test/](test) for test setup and helpers.
- [vitest.config.mts](vitest.config.mts) for unit tests.

## Troubleshooting

### Port 4040 Is Busy

`pnpm dev` already clears the port before starting, but you can check for a stuck process if the server still fails to start.

## File Layout

The main API entry points are:

- [src/](src) for the server and routes.
- [test/](test) for test setup and support files.
- [Dockerfile](Dockerfile) for container builds.

If you are unsure where to start, use `just dev api` and then follow the command table above.
