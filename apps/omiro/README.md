# Omiro

The mobile app is an Expo app that targets iOS only.

Product and mobile architecture are documented in the repository-level
documents [omiro.architecture](../../docs/omiro.architecture.md),
[omiro.chat](../../docs/omiro.chat.md), [omiro.planning](../../docs/omiro.planning.md),
[omiro.tasks](../../docs/omiro.tasks.md), and [omiro.voice](../../docs/omiro.voice.md). Release operations are in
the [`omiro-release` skill](../../.agents/skills/omiro-release/SKILL.md).

## Quick Start

```bash
pnpm install
just mobile rebuild
```

`rebuild` generates the iOS project, builds and installs the development
client, and launches it. After that, the normal JavaScript/TypeScript loop is:

```bash
just mobile run
```

Use `rebuild` again only after changing native dependencies, Expo config,
config plugins, permissions, entitlements, or local native modules. The
generated `apps/omiro/ios` directory is not a source tree.

## API configuration

`EXPO_PUBLIC_API_BASE_URL` is the sole API address used by the app. Set it in
`.env.development.local`: use `http://localhost:4040` for the iOS Simulator,
or a reachable LAN/tunnel URL for a physical device. Production builds receive
the value from the EAS production environment.

## Validate a change

Run the focused CI-equivalent lane before pushing:

```bash
just mobile check
```

For a user-visible interaction, run its Maestro flow. This command reuses the
installed development client but owns an isolated E2E Metro session so
test-only behavior cannot be missing or stale:

```bash
just mobile maestro apps/omiro/tests/flows/<flow>.yaml
```

The runner starts a scripted local API when needed and reuses one that is
already running in scripted mode.

Maestro also requires Java 17 and a booted iOS Simulator. See [AGENTS.md](AGENTS.md)
for the evidence harness details.

## Release

Omiro is built and shipped from the maintainer's machine, not through the paid
EAS cloud workflow. The production binary goes out like this:

```text
merge to main -> just mobile check -> build:prod:local -> submit:local -> TestFlight
```

Run it from `apps/omiro` on an up-to-date `main` with a clean working tree (the build
script refuses to run with uncommitted changes to tracked files, so the IPA always
corresponds to a commit):

```bash
pnpm eas:pull:prod      # refreshes the gitignored .eas-prod.local
pnpm build:prod:local   # verifies the production identity, writes build/prod-local.ipa
pnpm submit:local       # re-checks the identity, uploads that IPA to App Store Connect
```

- The build needs Xcode, a signed-in `eas-cli`, and `.eas-prod.local` with
  `SENTRY_AUTH_TOKEN` (an EAS Secret cannot be pulled, so keep it in that file). It runs
  `verify:release` first and stops unless the app resolves to `Omiro` with
  `com.pontistudios.hakumi` in production.
- `eas build --local` compiles on this machine. EAS only assigns the build
  number (`autoIncrement`) and hands the IPA to App Store Connect.
- Apple processes the upload for 5-10 minutes and emails when it is ready in
  [TestFlight](https://appstoreconnect.apple.com/apps/6760221796/testflight/ios).
  Install it and exercise a Time request on a real device before announcing it.
- Do not set `SENTRY_DISABLE_AUTO_UPLOAD` or `SENTRY_ALLOW_FAILURE` for a
  TestFlight candidate: source maps and dSYMs must upload.
- `expo doctor` runs during the build and may warn about patch-level package
  mismatches. That does not stop the build.

Do not use `.eas/workflows/production-release.yml` for a normal release; it
runs the build on EAS. The `deploy-mobile` GitHub workflow that starts it is
disabled (manual dispatch only). A JavaScript-only hotfix that does
not change native dependencies or config can use an OTA update, which does go
through an EAS workflow, so check the cost first:

```bash
just mobile update "<message>"
```

The `omiro-release` skill has the full operational runbook, including
verification steps and recovery.

## Useful commands

| Need                                                       | Run                                       |
| ---------------------------------------------------------- | ----------------------------------------- |
| First run or native/config change                          | `just mobile rebuild`                     |
| Everyday JS/TS development                                 | `just mobile run`                         |
| Format, lint, build API types, typecheck, test, and export | `just mobile check`                       |
| Run Maestro evidence                                       | `just mobile maestro [flow-or-directory]` |
| Build the production IPA locally                           | `pnpm build:prod:local` (in `apps/omiro`) |
| Upload that IPA to TestFlight                              | `pnpm submit:local` (in `apps/omiro`)     |
| Publish an approved JS-only OTA (EAS workflow)             | `just mobile update "<message>"`          |

## Testing

Use the canonical `just mobile maestro` runner for iOS simulator evidence. It
starts the installed development client in E2E mode, checks Java 17 and
simulator prerequisites, authenticates the test app, and runs the requested
flows. Individual flows assume that authenticated baseline.

User-visible interaction changes require Maestro evidence and visual inspection
of each changed acceptance state. Type checks and unit tests supplement, but do
not replace, that evidence. See [AGENTS.md](AGENTS.md) for the simulator,
Maestro, and E2E authentication runbook.
