## Context

The mobile app at `apps/mobile` uses Expo SDK 55 with React Native 0.83 and the New Architecture enabled. The project has four runtime variants (`dev`, `e2e`, `preview`, `production`) configured in `app.config.ts`, and a corresponding `eas.json` was just created in the `mobile-ci-redesign` change.

The configuration has accumulated several issues across: `app.config.ts`, `babel.config.js`, `tsconfig.json`, `package.json`, `eas.json`, and `ios/Podfile.properties.json`.

## Goals / Non-Goals

**Goals:**
- Fix configuration issues that risk build failures, binary bloat, or runtime errors
- Align configuration between `app.config.ts`, `eas.json`, and native files
- Ensure all babel plugins required by dependencies are present

**Non-Goals:**
- No changes to runtime behavior or application code
- No new features or capability changes
- No changes to the iOS native project beyond property files

## Decisions

### 1. `assetBundlePatterns` — narrow to `assets/**/*`

Currently `['**/*']` bundles everything including `node_modules`, `.git`, build artifacts, and the entire `ios/` and `android/` directories. The app only needs `assets/` directory.

**Decision:** Change to `['assets/**/*', 'api/**/*', 'hooks/**/*', 'constants/**/*', 'services/**/*', 'navigation/**/*', 'app/**/*']` to be explicit about what gets bundled.

Note: Expo's standard approach is `['assets/**/*']` only. Since the project doesn't use a single `assets/` directory (has `assets/`, `api/`, `hooks/`, `constants/`, `services/`, `navigation/`, `app/` all at root level for Expo file-based routing), we need to enumerate the directories that contain the app code.

Alternative: Use `['*']` which excludes `node_modules`, `.git`, etc. but includes everything at root level. This is simpler but less controlled.

**Chosen:** `['assets/**/*']` plus the root-level app directories. Better to be explicit.

### 2. `eas.json` — add `e2e` profile, rename `development` → `dev`

The `development` profile name in `eas.json` doesn't match `APP_VARIANT=dev`. Renaming it makes the mapping obvious.

**Decision:** Rename `development` → `dev`, add `e2e` profile.

```json
{
  "build": {
    "dev": { ... },
    "e2e": { ... },
    "preview": { ... },
    "production": { ... }
  }
}
```

### 3. Plugin order — move `expo-build-properties` first after `expo-router`

`expo-build-properties` sets iOS build properties (`deploymentTarget`, `infoPlist`) that other plugins may depend on. It should run before any plugin that reads or modifies those properties.

**Decision:** Move `expo-build-properties` to be the second plugin (after `expo-router`, before `expo-splash-screen`). The `expo-dev-client` conditionally inserts at position 1, so `expo-build-properties` should be at position 2 unconditionally.

### 4. Babel plugin — add `react-native-worklets/plugin`

`react-native-worklets` is a dependency of `react-native-reanimated@4.x`. It requires its own babel plugin to properly transform worklet functions.

**Decision:** Add `['react-native-worklets/plugin']` to `babel.config.js` plugins, before the reanimated plugin (which must be last).

```js
plugins: [
  'react-native-worklets/plugin',
  'react-native-reanimated/plugin',  // must be last
]
```

### 5. Node engine — align with root `package.json`

Root `package.json` requires `node >= 24.14.1`, but mobile allows `>= 20.0.0`.

**Decision:** Change mobile's `package.json` engine to `>= 24.14.1` to match the root.

### 6. TypeScript — set `allowJs: true`

Some Expo/RN packages ship TypeScript source with `.js` files. `allowJs: false` can cause import failures.

**Decision:** Set `allowJs: true` in `apps/mobile/tsconfig.json`.

### 7. Dependencies — clean up `package.json`

- Remove `react-native-svg` from `peerDependencies` (already in `dependencies`)
- Remove `@babel/runtime` from direct dependencies (typically transitive)
- Pin `msw` version with `~` instead of `^`

### 8. iOS deployment target — single source of truth

Currently set in both `app.config.ts` (via `expo-build-properties`) and `ios/Podfile.properties.json`. The Podfile defaults to `15.1` if not set in `Podfile.properties.json`.

**Decision:** Remove `ios.deploymentTarget` from `expo-build-properties` in `app.config.ts` and rely solely on `ios/Podfile.properties.json`. Set it explicitly in `Podfile.properties.json` to `17.4`.

## Risks / Trade-offs

- **[Risk]** Changing `assetBundlePatterns` could miss files needed at runtime if the app imports from non-standard locations.
  - **Mitigation:** Verify after the change that all app screens and services still load in dev mode.

- **[Risk]** Renaming `development` → `dev` in `eas.json` breaks any existing CI/scripts that reference `eas build --profile development`.
  - **Mitigation:** No CI currently references `development` profile; the only CI use is `production`.

- **[Risk]** Removing deployment target from `app.config.ts` means that value is no longer visible in the Expo config documentation.
  - **Mitigation:** `Podfile.properties.json` is the canonical source for native build settings; `app.config.ts` was redundant.

## Migration Plan

1. Read all relevant files (`app.config.ts`, `babel.config.js`, `tsconfig.json`, `package.json`, `eas.json`, `ios/Podfile.properties.json`)
2. Make changes incrementally, verifying typecheck still passes after each
3. Run `pnpm --filter @hominem/mobile run typecheck` after changes
4. Run `just mobile-check` to verify nothing breaks
5. No native rebuild needed for config-only changes

## Open Questions

- Should we also rename `preview` to `internal` in both `app.config.ts` and `eas.json` for consistency? Currently both use `preview` so it's consistent, just not descriptive.
