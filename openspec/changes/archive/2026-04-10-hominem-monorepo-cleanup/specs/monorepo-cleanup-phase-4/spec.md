## ADDED Requirements

### Requirement: Docker images are built for all services
The API service (`services/api`) and web app (`apps/web`) SHALL have Dockerfiles in their respective directories. These images SHALL be buildable without errors and runnable with appropriate environment configuration.

#### Scenario: API Docker image builds successfully
- **WHEN** running `docker build services/api -t hominem-api`
- **THEN** the image builds without errors

#### Scenario: Web Docker image builds successfully
- **WHEN** running `docker build apps/web -t hominem-web`
- **THEN** the image builds without errors

### Requirement: Type guards prevent unsafe JSON casts
Throughout the database layer and API routes, JSON data from external sources (database, API responses) SHALL be validated with type guards instead of unsafe casts (`as unknown as Type`).

#### Scenario: Database JSON columns use type guards
- **WHEN** loading records from Postgres JSONB columns
- **THEN** data is validated with type guard functions; no unsafe double casts exist

#### Scenario: API response validation uses type guards
- **WHEN** parsing third-party API responses
- **THEN** data is validated before use; unsafe casts are removed

### Requirement: Test assertions are concrete
Test files SHALL use concrete expected values or `expect.objectContaining()` instead of loose assertions like `expect.any(String)` or `expect.any(Object)`.

#### Scenario: Test assertions are specific
- **WHEN** running tests
- **THEN** assertions check for specific values, shapes, or types (e.g., `expect(result).toEqual({ id: 'abc', ...specific fields... })`)

### Requirement: Error handling is consistent across apps
Error formatting, display, and logging SHALL follow a single pattern across web and mobile apps. Errors SHALL be formatted consistently and displayed to users (not silently logged).

#### Scenario: Error formatting is centralized
- **WHEN** an error occurs in either app
- **THEN** it is formatted using a shared `formatApiError()` function and displayed to the user

### Requirement: Loading states are unified
Loading indicators (spinners, text, skeletons) SHALL use a single `<LoadingState />` component from `packages/platform/ui`. Different loading states (full page, inline, skeleton) SHALL have consistent UX.

#### Scenario: Loading states use shared component
- **WHEN** displaying a loading state
- **THEN** the UI uses `<LoadingState />` from `@hominem/platform/ui` with consistent styling and messaging

### Requirement: Infrastructure directory is clean
The `infra/kubernetes/` directory SHALL either contain real Kubernetes manifests or be deleted if empty. Empty scaffolding directories SHALL not exist.

#### Scenario: Kubernetes directory is either populated or deleted
- **WHEN** reviewing infrastructure setup
- **THEN** `infra/kubernetes/` either contains manifests or is removed

### Requirement: TSConfig inheritance is simplified
The tsconfig hierarchy in `tsconfig.profiles/` SHALL be flattened to 2-3 clear profiles instead of 4+ levels of inheritance. `noUnusedLocals` SHALL be enabled to catch dead code.

#### Scenario: TSConfig hierarchy is minimal
- **WHEN** reviewing `tsconfig.profiles/`
- **THEN** no more than 3 profile files exist (e.g., base.json, app.json, lib.json)

#### Scenario: Unused locals are detected
- **WHEN** running `turbo check`
- **THEN** `noUnusedLocals: true` is set in base tsconfig and unused variables are flagged

### Requirement: Clean up incomplete refactors
TODO comments indicating incomplete refactors (e.g., "TODO: Move file processing to background queue") SHALL either be completed or converted to GitHub issues. Incomplete code SHALL not remain in the main branch.

#### Scenario: TODOs are resolved
- **WHEN** searching for TODO comments
- **THEN** all TODOs are either completed or linked to GitHub issues

### Requirement: Phase 4 verification passes
After completing Phase 4 improvements, the full test suite, type checks, linting, and coverage checks SHALL pass without errors or warnings.

#### Scenario: All quality checks pass
- **WHEN** running `vitest run`, `turbo check`, `oxlint .`, and `knip`
- **THEN** all commands succeed with no errors
