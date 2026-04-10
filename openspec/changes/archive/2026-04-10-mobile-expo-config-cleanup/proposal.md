## Why

Expo app configuration has accumulated several issues that risk build failures, app store rejections, or runtime bugs:

- `assetBundlePatterns: ['**/*']` bundles the entire project including node_modules, inflating the binary
- `eas.json` is missing an `e2e` build profile, so EAS builds for the e2e variant would fail
- `eas.json` profile names (`development`) don't align with `APP_VARIANT` names (`dev`), causing confusion
- `expo-build-properties` plugin is not first in the plugin list, risking build property conflicts
- `react-native-worklets` babel plugin is missing, causing potential "function is not a worklet" runtime errors
- Node engine constraint in mobile's `package.json` contradicts the root `package.json`
- `allowJs: false` in tsconfig may cause library compatibility issues
- iOS deployment target is set in two places, creating drift risk
- `peerDependencies` has redundant entries; `@babel/runtime` is a direct dependency unnecessarily

## What Changes

- Narrow `assetBundlePatterns` to only `assets/**/*`
- Add `e2e` build profile to `eas.json`
- Rename `eas.json` `development` profile to `dev` for consistency with `APP_VARIANT`
- Reorder plugins in `app.config.ts` so `expo-build-properties` runs first
- Add `react-native-worklets/plugin` to `babel.config.js`
- Align Node engine in `apps/mobile/package.json` with root `package.json`
- Set `allowJs: true` in `apps/mobile/tsconfig.json`
- Remove redundant `peerDependencies` entry for `react-native-svg`
- Remove unnecessary direct `@babel/runtime` dependency
- Consolidate iOS deployment target to a single source (`Podfile.properties.json`)
- Update `ios/Podfile.properties.json` to set `newArchEnabled` explicitly for consistency

## Capabilities

### New Capabilities
- *(none)* — configuration cleanup, no new product capabilities

### Modified Capabilities
- *(none)* — no product behavior changes

## Impact

- `apps/mobile/app.config.ts` — plugin reordering, asset pattern change
- `apps/mobile/eas.json` — new `e2e` profile, renamed `development` → `dev`
- `apps/mobile/babel.config.js` — added worklets babel plugin
- `apps/mobile/tsconfig.json` — `allowJs: true`
- `apps/mobile/package.json` — engine, peerDependencies, and dependency cleanup
- `apps/mobile/ios/Podfile.properties.json` — deployment target and newArch settings
- `openspec/changes/mobile-ci-redesign/tasks.md` — task 1.1 and 2.3 may need updating if eas.json changes affect that change
