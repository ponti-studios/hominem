# Hominem Web

A React Router web app with pnpm-based commands for local development, testing, and browser end-to-end checks.

## Quick Start

```bash
pnpm install
pnpm dev
```

Use `pnpm test` for fast component and route feedback while you work.

## How To Think About The Commands

| Need                       | Run                 | When to use it                                   |
| -------------------------- | ------------------- | ------------------------------------------------ |
| Start local development    | `pnpm dev`       | Normal day-to-day work                           |
| Build the app              | `pnpm build`     | Before deployment or to verify production output |
| Run the app after a build  | `pnpm start`     | Smoke test the built server locally              |
| Check code style           | `pnpm lint`      | Before commits and PRs                           |
| Format code                | `pnpm format`    | Fix formatting issues quickly                    |
| Check TypeScript           | `pnpm typecheck` | Before commits and PRs                           |
| Run unit/integration tests | `pnpm test`      | Normal coding feedback                           |
| Run browser E2E tests      | `pnpm test:e2e`  | UI or auth flow changes                          |

## Daily Workflow

For most web changes, the loop is simple:

1. Start with `pnpm dev`.
2. Use `pnpm test` while iterating.
3. Run `pnpm lint` and `pnpm typecheck` before you stop.
4. Run `pnpm test:e2e` when a change needs browser coverage.

## Workflow Guide

### Local Development

`pnpm dev` starts the React Router development server.

The web app is meant to run against the local API at `http://localhost:4040`.

### Builds

`pnpm build` produces the server and client build output.

`pnpm start` serves the built app from `build/server/index.js`.

### Testing

`pnpm test` runs the Vitest suite.

`pnpm test:e2e` runs the Playwright browser suite in `tests/`.

The Playwright config starts the API and web servers for you when needed.

### Quality And Type Safety

`pnpm lint`, `pnpm format`, and `pnpm typecheck` cover the common pre-PR checks.

## Configuration Model

The important web files are:

- [package.json](package.json) for scripts.
- [react-router.config.ts](react-router.config.ts) for React Router wiring.
- [vite.config.ts](vite.config.ts) for build and test config.
- [playwright.config.ts](playwright.config.ts) for browser E2E.
- [tests/](tests) for Playwright specs and helpers.

## Troubleshooting

### Dev Server Does Not Load Data

Make sure the API is running on port 4040, or let the Playwright config start it for E2E runs.

### Typegen Looks Stale

Run `pnpm typegen` after changing routes or route exports.

### E2E Tests Fail To Start

Run `pnpm build` once to confirm the app builds cleanly, then retry `pnpm test:e2e`.

## File Layout

The main web entry points are:

- [app/](app) for route modules and UI.
- [tests/](tests) for Vitest and Playwright test code.
- [public/](public) for static assets.
- [build/](build) for generated output.

If you are unsure where to start, use `pnpm dev` and then follow the command table above.
