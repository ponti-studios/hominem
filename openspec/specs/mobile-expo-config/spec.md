## ADDED Requirements

### Requirement: Asset bundle patterns are scoped to app directories only

The Expo configuration SHALL NOT bundle `node_modules`, `.git`, build artifacts, or native project directories.

#### Scenario: Expo prebuild generates minimal bundle
- **WHEN** `expo prebuild --platform ios --clean` is run
- **THEN** `assetBundlePatterns` in `app.config.ts` is set to only include `assets/**/*` and the app's source directories (api, app, constants, hooks, navigation, services)
- **AND** the generated `ios/` directory is excluded from the bundle

### Requirement: EAS build profiles align with runtime variants

The `eas.json` build profile names SHALL match the `APP_VARIANT` values used at runtime.

#### Scenario: EAS builds the correct binary for each variant
- **WHEN** `eas build --platform ios --profile dev` is run
- **THEN** the built app uses `com.pontistudios.hakumi.dev` bundle identifier
- **AND** the `APP_VARIANT` environment variable is set to `dev`

#### Scenario: EAS can build the e2e variant
- **WHEN** `eas build --platform ios --profile e2e` is run
- **THEN** the built app uses `com.pontistudios.hakumi.e2e` bundle identifier
- **AND** no error is raised about a missing profile

### Requirement: Babel plugins include all required worklets transformation

The `babel.config.js` SHALL include the `react-native-worklets/plugin` before the `react-native-reanimated/plugin`.

#### Scenario: Worklet functions compile without errors
- **WHEN** `pnpm exec expo start --platform ios` is run
- **THEN** no "function is not a worklet" errors appear
- **AND** reanimated animations function correctly

### Requirement: TypeScript allows JavaScript imports

The `tsconfig.json` SHALL set `allowJs: true` to support Expo/RN packages that ship TypeScript source with JavaScript files.

#### Scenario: Mixed TypeScript and JavaScript packages import correctly
- **WHEN** TypeScript compilation runs via `tsc --noEmit`
- **THEN** imports from packages with `.js` files resolve without errors

### Requirement: Node engine constraint is consistent with monorepo root

The `apps/mobile/package.json` `engines.node` SHALL match the root `package.json` engine requirement.

#### Scenario: Developers use the correct Node version
- **WHEN** a developer runs `node --version`
- **THEN** the version is `>= 24.14.1` (matching root requirement)
- **AND** no version mismatch warnings appear during `pnpm install`

### Requirement: Expo build properties plugin runs before other plugins

The `expo-build-properties` plugin SHALL be the first plugin (after `expo-router`) in the `app.config.ts` plugin array.

#### Scenario: Build properties apply before dependent plugins
- **WHEN** `expo prebuild --platform ios` is run
- **THEN** the `expo-build-properties` plugin executes before `expo-splash-screen` and other plugins
- **AND** iOS deployment target and Info.plist settings are applied correctly

### Requirement: Package dependencies are minimal and non-redundant

The `apps/mobile/package.json` SHALL NOT list packages in both `dependencies` and `peerDependencies` that are the same package.

#### Scenario: Dependency installation succeeds without conflicts
- **WHEN** `pnpm install` runs in the mobile directory
- **THEN** no peer dependency warnings appear for `react-native-svg`
- **AND** `@babel/runtime` is not listed as a direct dependency
