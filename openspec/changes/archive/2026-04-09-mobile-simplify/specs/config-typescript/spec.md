## ADDED Requirements

### Requirement: Config files SHALL use TypeScript

All files in `apps/mobile/config/` SHALL be `.ts` files using ES module `import`/`export` syntax instead of CommonJS `require()`.

#### Scenario: Config files are TypeScript modules

- **WHEN** examining `config/` directory
- **THEN** all files have `.ts` extension
- **AND** all use `import`/`export` syntax

### Requirement: App variant config SHALL be typed

The `config/app-variant.ts` SHALL export TypeScript types for `AppVariant`, `VariantConfig`, and `APP_VARIANTS` constant.

#### Scenario: AppVariant type is exported

- **WHEN** TypeScript code imports `AppVariant` from `config/app-variant`
- **THEN** it resolves to the string literal union type `'dev' | 'e2e' | 'preview' | 'production'`

#### Scenario: VariantConfig is fully typed

- **WHEN** accessing `APP_VARIANTS.dev`
- **THEN** TypeScript infers `{ bundleIdentifier: string; displayName: string; scheme: string; usesDevClient: boolean; updatesChannel: string | null; }`

### Requirement: Expo config helper SHALL be TypeScript

The `config/expo-config.ts` SHALL export typed functions and constants for Expo extra config.

#### Scenario: getExpoExtraConfig is typed

- **WHEN** calling `getExpoExtraConfig(env)`
- **THEN** TypeScript infers return type `{ apiBaseUrl: string; mobilePasskeyEnabled: string; }`

### Requirement: Brand assets SHALL be typed

The `config/brand-assets.ts` SHALL export typed functions and constants.

#### Scenario: getBrandAssetPaths returns typed structure

- **WHEN** calling `getBrandAssetPaths(variant)`
- **THEN** TypeScript infers return type `{ favicon: string; icon: string; splash: string; }`

### Requirement: Release env policy SHALL be typed

The `config/release-env-policy.ts` SHALL export typed functions and constants.

#### Scenario: isReleaseVariant is typed

- **WHEN** calling `isReleaseVariant(variant)`
- **THEN** TypeScript infers return type `boolean`

#### Scenario: assertReleaseEnv parameters are typed

- **WHEN** calling `assertReleaseEnv(variant, env)`
- **THEN** TypeScript validates `variant: AppVariant` and `env: Record<string, string | undefined>`

### Requirement: App.config.ts SHALL use ES imports

The `apps/mobile/app.config.ts` SHALL use `import` statements to load config modules instead of `require()`.

#### Scenario: App config uses ES module imports

- **WHEN** examining `app.config.ts`
- **THEN** all config module imports use `import ... from '...'`
- **AND** no `require()` calls remain

### Requirement: Config files SHALL be tree-shakeable

Each config file SHALL use named exports and avoid side effects at module evaluation time.

#### Scenario: Config modules have no side effects

- **WHEN** importing `config/app-variant`
- **THEN** no code runs until a named export is explicitly called
