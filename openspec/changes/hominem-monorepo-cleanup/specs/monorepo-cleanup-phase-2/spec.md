## ADDED Requirements

### Requirement: Vitest versions are unified
All packages in the monorepo SHALL use vitest version 4.1.2. There SHALL be no per-package vitest overrides; the version SHALL be defined in root `devDependencies` and inherited by all packages through workspace hoisting.

#### Scenario: Single vitest version across all packages
- **WHEN** running `bun install`
- **THEN** all packages use vitest 4.1.2 and no package.json declares a different version

### Requirement: @types/node versions are consistent
All packages in the monorepo SHALL declare @types/node version ^25.4.0. There SHALL be no version splits (e.g., ^22.10.7 in `packages/core/db`).

#### Scenario: Type definitions are consistent
- **WHEN** running `bun ls @types/node`
- **THEN** all packages receive the same version of @types/node

### Requirement: React and React-related types are pinned exactly
Packages declaring React, React DOM, and React-related type dependencies SHALL use exact pinned versions, not ranges (no tilde `~` or caret `^`). Version: `19.2.10` for @types/react, `19.1.7` for @types/react-dom.

#### Scenario: No version range variations
- **WHEN** inspecting all package.json files
- **THEN** @types/react is declared as `19.2.10` and @types/react-dom as `19.1.7` (no ranges)

### Requirement: react-markdown version is unified
The root `package.json` overrides SHALL declare react-markdown as ^10.1.0. The `packages/platform/ui` package SHALL either inherit this override or explicitly declare the same version (not ^9.0.0).

#### Scenario: react-markdown resolves to consistent version
- **WHEN** running `bun ls react-markdown`
- **THEN** all packages receive react-markdown 10.x, not 9.x

### Requirement: Zod version is pinned exactly
All packages declaring zod as a dependency SHALL use exact version 4.3.6, not a range like ^4.3.6.

#### Scenario: Zod version is exact across packages
- **WHEN** inspecting all package.json files
- **THEN** zod is declared as `4.3.6` everywhere

### Requirement: Node engine requirement is consistent
The root `package.json` engines.node SHALL specify the minimum version required by all packages. If mobile requires >=22.11.0, the root SHALL match; otherwise, root >=20.0.0 is acceptable.

#### Scenario: Engine versions align
- **WHEN** reading engines declarations
- **THEN** root engines.node matches or exceeds all package-level requirements

### Requirement: Package exports are consistent
All packages SHALL use consistent patterns for `main`, `types`, and `exports` fields. Exports SHALL point to built output (./build/), not source files (./src/), unless using a bundler that requires source.

#### Scenario: Package exports resolve correctly
- **WHEN** importing from a package
- **THEN** resolver uses built output with correct types

### Requirement: Vitest config extensions are standardized
All `vitest.config.*` files throughout the monorepo SHALL use `.config.ts` extension, not `.config.mts`. This includes files in `services/api`, `packages/core/*`, and `packages/domains/*`.

#### Scenario: Single vitest config extension
- **WHEN** listing all vitest.config files
- **THEN** all use `.config.ts` (no `.mts` variants)

### Requirement: Phase 2 verification passes
After completing Phase 2 dependency alignment, the full test suite and type checks SHALL pass.

#### Scenario: Tests and type checking succeed
- **WHEN** running `vitest run` and `turbo check`
- **THEN** all tests pass and no type errors occur
