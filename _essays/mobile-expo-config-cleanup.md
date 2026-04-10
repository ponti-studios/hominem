# Mobile Expo Config Cleanup

## Problem

The Expo mobile application configuration accumulated several configuration issues that risked build failures, app store rejections, or runtime errors. The `assetBundlePatterns` setting was overly broad, bundling the entire project including node_modules and native build directories, unnecessarily inflating the binary. The `eas.json` build profile names didn't align with the `APP_VARIANT` runtime names (profile named `development` while the variant was `dev`), creating confusion during builds. The babel configuration was missing the `react-native-worklets/plugin`, which is required by the reanimated dependency but would silently fail to transform worklet functions.

Beyond the Expo-specific issues, configuration drifted across multiple files: iOS deployment target was set in both `app.config.ts` and the native `Podfile.properties.json`, creating a dual source of truth. The `expo-build-properties` plugin was not positioned early in the plugin list, risking build property conflicts with plugins that read or modify those same properties. TypeScript configuration had `allowJs: false`, which could cause import failures for dependencies that ship TypeScript source with some `.js` files. Node engine requirements differed between the root `package.json` and the mobile app, creating environment incompatibilities.

## Exploration

The team considered several options for managing asset bundling. The obvious solution was narrowing `assetBundlePatterns` to `['assets/**/*']`, following Expo's standard. However, the application's file structure didn't use a single assets directory—code was split across `assets/`, `api/`, `hooks/`, `constants/`, and other root-level directories for Expo file-based routing. This required choosing between enumerating each directory explicitly (more control, clearer intent) or using a catch-all pattern like `['*']` which excludes node_modules but loses granularity.

For the profile naming issue, renaming `development` to `dev` would align the `eas.json` profiles with the `app.config.ts` runtime variants. The concern was whether any existing CI or local scripts referenced the `development` profile name, which would require updating. The team verified that only the `production` profile was actively used in CI, making the rename safe.

The babel plugin ordering question involved understanding which plugins depended on which transforms. The `expo-build-properties` plugin sets native iOS properties that other plugins might read. Should it run early to establish those properties, or later to avoid interfering with other transforms? Similarly, the `react-native-reanimated/plugin` documentation stated it should be last in the plugin chain.

## Solution

Asset bundling was narrowed to explicitly enumerate the app's source directories: `['assets/**/*', 'api/**/*', 'hooks/**/*', 'constants/**/*', 'services/**/*', 'navigation/**/*', 'app/**/*']`. This was more granular than Expo's standard `['assets/**/*']` pattern but appropriate for the application's non-standard file structure. The explicit enumeration prevents the bundle from accidentally including build artifacts, git metadata, or native directories.

The `eas.json` build profiles were renamed to match the runtime variant names: `development` became `dev`, and a new `e2e` profile was added for the e2e variant that had no profile defined previously. This made the mapping between `APP_VARIANT` and EAS profile explicit and eliminated the confusion that arises when configuration uses different naming conventions.

Plugin ordering in `app.config.ts` was adjusted to place `expo-build-properties` early (second, after `expo-router`) so that properties were established before other plugins that might read them. The `react-native-worklets/plugin` was added to `babel.config.js` before the reanimated plugin, ensuring worklet functions were properly transformed.

iOS deployment target configuration was consolidated to a single source. The `expo-build-properties` plugin in `app.config.ts` was removed as the source of truth, and `ios/Podfile.properties.json` became the canonical location for `deploymentTarget` setting at version 17.4.

Node engine requirements in `apps/mobile/package.json` were updated to match the root `package.json` (`node >= 24.14.1`), ensuring consistent runtime environments. TypeScript configuration was changed to `allowJs: true` to allow imports from dependencies that ship TypeScript source alongside `.js` files.

Package.json cleanup removed redundant entries: `react-native-svg` was removed from peerDependencies (already in dependencies), and `@babel/runtime` was removed as a direct dependency (typically transitive through other packages).

## Learnings

Configuration drifts when the same setting is defined in multiple files. The team found that setting iOS deployment target in both `app.config.ts` and `Podfile.properties.json` created a maintenance burden and made it unclear which source was authoritative. Consolidating to a single source, even if that source is less visible than before, prevents divergence.

Naming conventions matter across configuration layers. When `eas.json` profiles didn't match `app.config.ts` variant names, developers had to mentally map between naming systems. Aligning naming conventions across files makes configuration more discoverable and self-documenting.

Babel plugin order is a subtle but critical detail. Plugins that establish properties should run early; plugins with specific ordering requirements (like reanimated) should run last. The team learned to check plugin documentation for ordering constraints rather than assuming any order works.

Required babel plugins must be explicitly declared. The `react-native-worklets/plugin` was a dependency of reanimated but was missing from the babel configuration. Without it, worklet functions would silently fail to transform, causing runtime errors. Making required plugins explicit prevents this class of silent failure.

Asset bundling patterns should be explicit, not catch-all. The initial `['**/*']` pattern was overly broad and included many unnecessary files, inflating the binary. A more explicit pattern, even if longer, better communicates intent and prevents accidental bundling of build artifacts or sensitive files.

Environment consistency across a monorepo reduces friction. When the root and mobile app had different Node engine requirements, developers could run into compatibility issues when switching between contexts. Aligning versions across the monorepo makes the development environment more predictable.

Configuration cleanup is low-risk work that prevents future bugs. None of these changes altered application behavior, but they fixed potential failure modes—binary bloat, missing plugins, unaligned deployment targets. This type of preventive work often gets deferred but pays dividends by preventing deployment surprises.
