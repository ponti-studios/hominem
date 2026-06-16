# Omiro

The mobile app is an Expo app that targets iOS only.

## Quick Start

```bash
pnpm install
just mobile-prebuild
just run-ios dev
```

## Working In Zed

Zed can edit the TypeScript/React Native sources directly, but Swift diagnostics for the native modules only work after the generated iOS project exists locally.

If you open one of the files under `modules/*/ios/*.swift` before bootstrapping the native project, Zed may show:

> `No such module 'ExpoModulesCore'`

That error usually means the iOS workspace has not been generated yet, or CocoaPods have not been installed for the local `apps/omiro/ios` directory.

### Recommended setup

1. Install the repo dependencies with `pnpm install`.
2. Generate the iOS project with `just mobile-prebuild`.
3. Run the iOS app with `just run-ios dev` when you want Expo to finish wiring the native project and launch the app.
4. Open the repo root in Zed after the iOS project has been generated so SourceKit can resolve the native modules.

## Troubleshooting

### `No such module 'ExpoModulesCore'`

- Make sure you have generated the iOS project locally with `just mobile-prebuild`.
- Make sure Xcode command line tools are installed and selected.
- Re-run `just run-ios dev` so Expo can refresh the iOS workspace and Pods.

If the error still appears, the local generated `apps/omiro/ios` directory is likely stale and should be regenerated.

## Useful Commands

| Need | Run | When to use it |
| --- | --- | --- |
| Generate the iOS project | `just mobile-prebuild` | First-time setup or after native config changes |
| Launch the iOS app | `just run-ios dev` | Daily mobile development |
| Start Metro / Expo | `just start-ios` | When you want to attach to an existing native build |
| Check the app docs | `apps/omiro/README.md` | When Zed or Swift diagnostics get confused |
