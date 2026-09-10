# Omiro

The mobile app is an Expo app that targets iOS only.

Product and mobile architecture are documented in the repository-level
documents [omiro.architecture](../../docs/omiro.architecture.md),
[omiro.chat](../../docs/omiro.chat.md), [omiro.time](../../docs/omiro.time.md),
and [omiro.voice](../../docs/omiro.voice.md). Release operations are in
the [`omiro-release` skill](../../.agents/skills/omiro-release/SKILL.md).

## Quick Start

```bash
just setup
just mobile prebuild development
just mobile dev
```

For production native identity verification:

```bash
just mobile prebuild production
```

## API configuration

`EXPO_PUBLIC_API_BASE_URL` is the sole API address used by the app. Set it in
`.env.development.local`: use `http://localhost:4040` for the iOS Simulator,
or a reachable LAN/tunnel URL for a physical device. Production builds receive
the value from the EAS production environment.

## Working in Zed

Swift diagnostics for local Expo modules require a generated iOS project and
installed CocoaPods. If Zed reports `No such module 'ExpoModulesCore'`, run:

```bash
just mobile prebuild development
just mobile dev
```

Use `just mobile prebuild production` when verifying the production identity.
The generated `apps/omiro/ios` directory is not a source tree.

## Useful commands

| Need | Run |
| --- | --- |
| Generate development iOS project | `just mobile prebuild development` |
| Generate production iOS project | `just mobile prebuild production` |
| Launch the iOS app | `just mobile dev` |
| Run Omiro tests | `just mobile test` |
| Run Maestro evidence | `just mobile maestro [flow-or-directory]` |
| Start a cloud production release | `just mobile release` |
| Build a local signed IPA | `pnpm build:prod:local` |
| Submit the newest local IPA | `pnpm submit:local` |
| Publish an approved JS-only OTA | `just mobile update "<message>"` |
| Start Metro / Expo | `just mobile start` |

## Testing

Use the canonical `just mobile maestro` runner for iOS simulator evidence. It
checks Java 17 and simulator prerequisites, authenticates the test app, and
runs the requested flows. Individual flows assume that authenticated baseline.

User-visible interaction changes require Maestro evidence and visual inspection
of each changed acceptance state. Type checks and unit tests supplement, but do
not replace, that evidence. See [AGENTS.md](AGENTS.md) for the simulator,
Maestro, and E2E authentication runbook.
