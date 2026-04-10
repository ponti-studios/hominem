# Hominem API

A Bun-based Hono API with focused commands for local development and maintenance.

## Quick Start

```bash
pnpm install
pnpm dev
```

## How To Think About The Commands

| Need                               | Run                            | When to use it                                    |
| ---------------------------------- | ------------------------------ | ------------------------------------------------- |
| Start local development            | `pnpm dev`                  | Normal day-to-day API work                        |
| Start the server once              | `pnpm start`                | Run the API without watch mode                    |
| Check code style                   | `pnpm lint`                 | Before commits and PRs                            |
| Format code                        | `pnpm format`               | Fix formatting issues quickly                     |
| Check TypeScript                   | `pnpm typecheck`            | Before commits and PRs                            |
| Run tests                          | `pnpm test`                 | Placeholder until the non-Storybook suite returns |
| Run coverage                       | `pnpm test:coverage`        | Measure test coverage before larger changes       |
| Run watch mode                     | `pnpm test:watch`           | Keep tests running while iterating                |
| Run the auth middleware perf check | `pnpm perf:auth-middleware` | Inspect auth middleware performance               |

## Daily Workflow

For most API changes, the loop is simple:

1. Start with `pnpm dev`.
2. Run `pnpm lint` and `pnpm typecheck` before you stop.

## Workflow Guide

### Local Development

`pnpm dev` kills anything already bound to port 4040 and starts the API in watch mode.

The API listens on `http://localhost:4040`.

### Testing

`pnpm test` is a placeholder until the non-Storybook suite is rewritten.

`pnpm test:coverage` is the heavier reporting path.

### Quality And Type Safety

`pnpm lint`, `pnpm format`, and `pnpm typecheck` cover the common pre-PR checks.

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

If you are unsure where to start, use `pnpm dev` and then follow the command table above.
