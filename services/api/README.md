# Hominem API

A Bun-based Hono API with focused commands for local development, unit tests, contract tests, and integration checks.

## Quick Start

```bash
bun install
bun run dev
```

Use `bun run test` for the default unit suite while you work.

## How To Think About The Commands

| Need                               | Run                            | When to use it                                    |
| ---------------------------------- | ------------------------------ | ------------------------------------------------- |
| Start local development            | `bun run dev`                  | Normal day-to-day API work                        |
| Start the server once              | `bun run start`                | Run the API without watch mode                    |
| Check code style                   | `bun run lint`                 | Before commits and PRs                            |
| Format code                        | `bun run format`               | Fix formatting issues quickly                     |
| Check TypeScript                   | `bun run typecheck`            | Before commits and PRs                            |
| Run unit tests                     | `bun run test`                 | Normal coding feedback                            |
| Run contract tests                 | `bun run test:contract`        | Validate API contracts and route behavior         |
| Run auth contract tests            | `bun run test:auth:contract`   | Focus on the auth OTP and token flows             |
| Run integration tests              | `bun run test:integration`     | Exercise broader API behavior with the test setup |
| Run coverage                       | `bun run test:coverage`        | Measure test coverage before larger changes       |
| Run watch mode                     | `bun run test:watch`           | Keep tests running while iterating                |
| Run the auth middleware perf check | `bun run perf:auth-middleware` | Inspect auth middleware performance               |

## Daily Workflow

For most API changes, the loop is simple:

1. Start with `bun run dev`.
2. Use `bun run test` or `bun run test:contract` while iterating.
3. Run `bun run lint` and `bun run typecheck` before you stop.
4. Run `bun run test:integration` or `bun run test:auth:contract` when the change touches shared behavior.

## Workflow Guide

### Local Development

`bun run dev` kills anything already bound to port 4040 and starts the API in watch mode.

The API listens on `http://localhost:4040`.

### Testing

`bun run test` runs the default Vitest suite.

`bun run test:contract`, `bun run test:auth:contract`, and `bun run test:integration` cover the broader behavior checks.

`bun run test:coverage` is the heavier reporting path.

### Quality And Type Safety

`bun run lint`, `bun run format`, and `bun run typecheck` cover the common pre-PR checks.

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

`bun run dev` already clears the port before starting, but you can check for a stuck process if the server still fails to start.

### Contract Tests Fail

Make sure the auth and database-related setup files are loaded for the right Vitest config, then rerun `bun run test:auth:contract`.

### Tests Pass In One Mode But Not Another

Run the specific suite you are touching instead of the default `bun run test` path so you can isolate the failure.

## File Layout

The main API entry points are:

- [src/](src) for the server and routes.
- [test/](test) for test setup and support files.
- [Dockerfile](Dockerfile) for container builds.

If you are unsure where to start, use `bun run dev` and then follow the command table above.
