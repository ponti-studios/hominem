## Hakumi monorepo

Hakumi is a notes-first personal workspace. This repository contains the apps, shared packages, services, infrastructure definitions, and product tooling that support capture, notes, and chat across platforms.

The repo uses Bun workspaces and Turbo.

### Prerequisites

- Bun 1.3.0
- Node.js 22.14.0

Toolchain versions are pinned in `.tool-versions` and `.node-version`.

### Source Of Truth

This repository intentionally does not duplicate runnable command strings in documentation.

If you need a concrete entrypoint, inspect the owning files directly:

- root `package.json` for the small cross-workspace surface
- workspace `package.json` files for package-local entrypoints
- `turbo.json` for graph task behavior
- `infra/docker/compose/*.yml` for local infrastructure lifecycle
- `.github/workflows/*.yml` and `.github/actions/*` for CI execution paths
- package-local config such as `eas.json`, Detox config, Playwright config, Storybook config, and app config files

### Working Model

- The root surface stays intentionally small.
- Package-local behavior lives with the owning workspace.
- Infrastructure behavior lives in Compose files and CI/workflow definitions.
- Documentation describes ownership and architecture, not shell snippets.

### Repository Shape

- `apps/` contains user-facing applications.
- `services/` contains service processes and APIs.
- `packages/` contains shared libraries, runtime packages, and UI building blocks.
- `tools/` contains product tooling packages.
- `infra/` contains infrastructure definitions.

### MCP Server Auth

The MCP server reads its auth token from a config file only.

- Path: `~/.hominem/config.json`
- Overrides: `HOMINEM_CONFIG_PATH` or `HOMINEM_CONFIG_DIR`
- Required field: `token`

Optional API endpoint overrides for MCP HTTP tools:

- `HOMINEM_API_HOST`
- `HOMINEM_API_PORT`
