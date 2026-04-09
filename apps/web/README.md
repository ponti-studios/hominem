# Hominem Web

A React Router web app with Bun-based commands for local development, testing, and browser end-to-end checks.

## Quick Start

```bash
bun install
bun run dev
```

Use `bun run test` for fast component and route feedback while you work.

## How To Think About The Commands

| Need                       | Run                 | When to use it                                   |
| -------------------------- | ------------------- | ------------------------------------------------ |
| Start local development    | `bun run dev`       | Normal day-to-day work                           |
| Build the app              | `bun run build`     | Before deployment or to verify production output |
| Run the app after a build  | `bun run start`     | Smoke test the built server locally              |
| Check code style           | `bun run lint`      | Before commits and PRs                           |
| Format code                | `bun run format`    | Fix formatting issues quickly                    |
| Check TypeScript           | `bun run typecheck` | Before commits and PRs                           |
| Run unit/integration tests | `bun run test`      | Normal coding feedback                           |
| Run browser E2E tests      | `bun run test:e2e`  | UI or auth flow changes                          |

## Daily Workflow

For most web changes, the loop is simple:

1. Start with `bun run dev`.
2. Use `bun run test` while iterating.
3. Run `bun run lint` and `bun run typecheck` before you stop.
4. Run `bun run test:e2e` when a change needs browser coverage.

## Workflow Guide

### Local Development

`bun run dev` starts the React Router development server.

The web app is meant to run against the local API at `http://localhost:4040`.

### Builds

`bun run build` produces the server and client build output.

`bun run start` serves the built app from `build/server/index.js`.

### Testing

`bun run test` runs the Vitest suite.

`bun run test:e2e` runs the Playwright browser suite in `tests/`.

The Playwright config starts the API and web servers for you when needed.

### Quality And Type Safety

`bun run lint`, `bun run format`, and `bun run typecheck` cover the common pre-PR checks.

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

Run `bun run typegen` after changing routes or route exports.

### E2E Tests Fail To Start

Run `bun run build` once to confirm the app builds cleanly, then retry `bun run test:e2e`.

## File Layout

The main web entry points are:

- [app/](app) for route modules and UI.
- [tests/](tests) for Vitest and Playwright test code.
- [public/](public) for static assets.
- [build/](build) for generated output.

If you are unsure where to start, use `bun run dev` and then follow the command table above.
