## Hakumi monorepo

Hakumi is a notes, chat, files, and voice product. This repository contains the web app, mobile app, API, and shared packages that support authenticated note CRUD, file uploads, speech-to-text, text-to-speech, and LLM chat with explicit note context across platforms.

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
- `infra/compose/*.yml` for shared local/CI infrastructure lifecycle
- `infra/images/postgres/Dockerfile` for the canonical Postgres image build context
- `infra/observability/*` for the telemetry stack config and docs
- `.github/workflows/*.yml` and `.github/actions/*` for CI execution paths that consume those Compose definitions
- package-local config such as `eas.json`, Detox config, Playwright config, Storybook config, and app config files

### Working Model

- The product surface centers on notes, chat, files, voice, and auth.
- Package-local behavior lives with the owning workspace.
- Infrastructure behavior lives in Compose files, and CI/workflow definitions consume those files instead of redefining services.
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
