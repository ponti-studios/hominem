## ADDED Requirements

### Requirement: Directory structure SHALL use semantic subdirectories

The `apps/mobile/lib/` directory SHALL be organized with the following subdirectory structure:

```
lib/
├── auth/                    # Auth subsystem (provider, machines, hooks, storage, analytics)
├── services/               # React Query hooks (chat, notes, inbox, files)
├── storage/               # Storage abstractions (MMKV, SQLite)
├── hooks/                 # Standalone hooks (useAppLock, useReducedMotion, etc.)
├── config/                # TypeScript config files (app-variant, brand-assets, etc.)
├── api/                   # API providers and connection handling
├── components/            # Shared mobile components (NOT under utils/ anymore)
└── ...
```

#### Scenario: All TypeScript files resolve correctly after migration

- **WHEN** a TypeScript file imports from `~/lib/auth/auth-provider`
- **THEN** the import resolves to `lib/auth/auth-provider.tsx`

#### Scenario: No duplicate imports across split directories

- **WHEN** TypeScript compiler runs with strict mode
- **THEN** no "Module not found" or "Cannot find module" errors occur

#### Scenario: Path aliases remain functional

- **WHEN** code uses `~/lib/` or `~/utils/` aliases
- **THEN** the bundler correctly resolves to the new directory structure

### Requirement: Legacy paths SHALL redirect to new paths

All imports using `~/utils/` SHALL continue to work during a transition period by updating the alias in `tsconfig.json` to point to `lib/`.

#### Scenario: tsconfig paths alias updated

- **WHEN** `tsconfig.json` has `"~/*": ["./lib/*"]`
- **THEN** all `~/utils/` imports resolve to `lib/`

### Requirement: Components directory boundary is respected

The `components/` directory SHALL remain at the top level (`apps/mobile/components/`) but SHALL NOT contain utility functions, hooks, or services that belong in `lib/`.

#### Scenario: Components contain only UI components

- **WHEN** examining `components/` subdirectories
- **THEN** each file is a React component, hook, or component-related utility (e.g., `notes-surface-motion.ts`)

#### Scenario: Non-component code does not live in components/

- **WHEN** examining `components/error-boundary/` or `components/input/`
- **THEN** each file either exports a component or contains component-specific logic (not generic utilities)
