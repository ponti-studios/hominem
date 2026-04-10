# Hominem API

A Bun-based Hono API with focused commands for local development, unit tests, contract tests, and integration checks.

## Quick Start

```bash
pnpm install
pnpm dev
```

Use `pnpm test` for the default unit suite while you work.

## How To Think About The Commands

| Need                               | Run                            | When to use it                                    |
| ---------------------------------- | ------------------------------ | ------------------------------------------------- |
| Start local development            | `pnpm dev`                  | Normal day-to-day API work                        |
| Start the server once              | `pnpm start`                | Run the API without watch mode                    |
| Check code style                   | `pnpm lint`                 | Before commits and PRs                            |
| Format code                        | `pnpm format`               | Fix formatting issues quickly                     |
| Check TypeScript                   | `pnpm typecheck`            | Before commits and PRs                            |
| Run unit tests                     | `pnpm test`                 | Normal coding feedback                            |
| Run contract tests                 | `pnpm test:contract`        | Validate API contracts and route behavior         |
| Run auth contract tests            | `pnpm test:auth:contract`   | Focus on the auth OTP and token flows             |
| Run integration tests              | `pnpm test:integration`     | Exercise broader API behavior with the test setup |
| Run coverage                       | `pnpm test:coverage`        | Measure test coverage before larger changes       |
| Run watch mode                     | `pnpm test:watch`           | Keep tests running while iterating                |
| Run the auth middleware perf check | `pnpm perf:auth-middleware` | Inspect auth middleware performance               |

## Daily Workflow

For most API changes, the loop is simple:

1. Start with `pnpm dev`.
2. Use `pnpm test` or `pnpm test:contract` while iterating.
3. Run `pnpm lint` and `pnpm typecheck` before you stop.
4. Run `pnpm test:integration` or `pnpm test:auth:contract` when the change touches shared behavior.

## Workflow Guide

### Local Development

`pnpm dev` kills anything already bound to port 4040 and starts the API in watch mode.

The API listens on `http://localhost:4040`.

### Testing

`pnpm test` runs the default Vitest suite.

`pnpm test:contract`, `pnpm test:auth:contract`, and `pnpm test:integration` cover the broader behavior checks.

`pnpm test:coverage` is the heavier reporting path.

### Quality And Type Safety

`pnpm lint`, `pnpm format`, and `pnpm typecheck` cover the common pre-PR checks.

## Configuration Model

The important API files are:

- [package.json](package.json) for scripts.
- [src/index.ts](src/index.ts) for server startup.
- [test/](test) for test setup and helpers.
- [vitest.config.mts](vitest.config.mts) for unit tests.
- [vitest.contract.config.mts](vitest.contract.config.mts) for contract tests.
- [vitest.integration.config.mts](vitest.integration.config.mts) for integration tests.

## Troubleshooting

### Port 4040 Is Busy

`pnpm dev` already clears the port before starting, but you can check for a stuck process if the server still fails to start.

### Contract Tests Fail

Make sure the auth and database-related setup files are loaded for the right Vitest config, then rerun `pnpm test:auth:contract`.

### Tests Pass In One Mode But Not Another

Run the specific suite you are touching instead of the default `pnpm test` path so you can isolate the failure.

## File Layout

The main API entry points are:

- [src/](src) for the server and routes.
- [test/](test) for test setup and support files.
- [Dockerfile](Dockerfile) for container builds.

If you are unsure where to start, use `pnpm dev` and then follow the command table above.
