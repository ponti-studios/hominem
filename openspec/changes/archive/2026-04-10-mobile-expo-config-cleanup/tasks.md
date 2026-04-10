## 1. Fix asset bundle patterns

- [x] 1.1 Change `assetBundlePatterns: ['**/*']` in `app.config.ts:234` to `['assets/**/*', 'api/**/*', 'app/**/*', 'constants/**/*', 'hooks/**/*', 'navigation/**/*', 'services/**/*']`

## 2. Fix eas.json

- [x] 2.1 Rename `development` profile to `dev` in `eas.json`
- [x] 2.2 Add `e2e` profile to `eas.json` with `developmentClient: false`, `distribution: "internal"`, `bundleIdentifier: "com.pontistudios.hakumi.e2e"`, `appleTeamId: "3QHJ2KN8AL"`

## 3. Reorder plugins in app.config.ts

- [x] 3.1 Move `expo-build-properties` plugin to position 2 (right after `expo-router`, before `expo-splash-screen`)
- [x] 3.2 Remove `deploymentTarget: '17.4'` from `expo-build-properties` in `app.config.ts` (keep `infoPlist` settings)
- [x] 3.3 Verify iOS deployment target is set only in `ios/Podfile.properties.json` (already set to `17.4`)

## 4. Add babel plugin for worklets

- [x] 4.1 **Skipped** — `react-native-reanimated@4.x` bundles the worklets plugin internally. Adding `react-native-worklets/plugin` separately causes a duplicate plugin error in Babel. No change needed; reanimated already handles worklets transformation.

## 5. Fix tsconfig.json

- [x] 5.1 Change `allowJs: false` to `allowJs: true` in `apps/mobile/tsconfig.json:9`

## 6. Fix package.json

- [x] 6.1 Change `engines.node` from `">=20.0.0"` to `">=24.14.1"` in `apps/mobile/package.json`
- [x] 6.2 Remove `react-native-svg` from `peerDependencies` in `apps/mobile/package.json` (already in `dependencies`)
- [x] 6.3 Remove `@babel/runtime` from `dependencies` in `apps/mobile/package.json` (typically transitive)
- [x] 6.4 Change `msw` version from `^2.12.14` to `~2.12.14` in `apps/mobile/package.json`

## 7. Verify changes

- [x] 7.1 Run `pnpm --filter @hominem/mobile exec tsc --noEmit` — pre-existing TS errors exist in codebase (unrelated to these changes)
- [x] 7.2 Run `pnpm --filter @hominem/mobile run mobile-check` — all 51 tests pass after fixing import paths in 3 files
