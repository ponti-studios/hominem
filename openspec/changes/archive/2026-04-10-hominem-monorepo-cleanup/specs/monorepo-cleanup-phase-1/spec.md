## ADDED Requirements

### Requirement: Ghost workspace declaration removed
The root `package.json` SHALL NOT declare `tools/*` in workspaces when the directory does not exist. The workspace declaration SHALL only include directories that are actual packages.

#### Scenario: Workspace resolves without error
- **WHEN** running `bun install`
- **THEN** no workspace resolution errors occur and all declared workspaces exist on disk

### Requirement: Empty root package.json fields removed
The root `package.json` SHALL NOT contain empty `scripts: {}` or `dependencies: {}` objects. These fields SHALL be omitted entirely.

#### Scenario: Package.json is syntactically clean
- **WHEN** parsing root `package.json`
- **THEN** no empty object fields exist in the file

### Requirement: Trailing commas removed from tsconfig files
All `tsconfig.json` files throughout the monorepo SHALL have valid JSON syntax with no trailing commas in objects or arrays.

#### Scenario: Tsconfig files parse as valid JSON
- **WHEN** parsing any tsconfig.json file
- **THEN** JSON parsing succeeds without trailing comma errors

### Requirement: Unclear directories documented or removed
Directories at the repository root with unclear purpose (`.fallow/`, `.opencode/`) SHALL either be documented in README or deleted if not actively used.

#### Scenario: Root directories have clear purpose
- **WHEN** reviewing files at repository root
- **THEN** all directories have clear ownership and are either documented or removed

### Requirement: Phase 1 verification passes
After completing Phase 1 fixes, core build and check commands SHALL pass without errors.

#### Scenario: Build and verification succeed
- **WHEN** running `bun install`, `bun run --filter '*' build`, and `turbo check`
- **THEN** all commands succeed with no errors or warnings
