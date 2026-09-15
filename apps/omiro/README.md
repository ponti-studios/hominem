# Omiro

The mobile app is an Expo app that targets iOS only.

Product and mobile architecture are documented in the repository-level
documents [omiro.architecture](../../docs/omiro.architecture.md),
[omiro.chat](../../docs/omiro.chat.md), [omiro.time](../../docs/omiro.time.md),
and [omiro.voice](../../docs/omiro.voice.md). Release operations are in
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

The production binary has one standard path:

```text
merge to main -> validate-mobile -> deploy-mobile -> approve in EAS -> build -> TestFlight
```

Do not run a local release command for a normal release. For an approved
JavaScript-only hotfix that does not change native dependencies or config, run:

```bash
just mobile update "<message>"
```

That workflow validates first, waits for approval, then publishes to the
production update channel. Local IPA recovery procedures live only in the
`omiro-release` operational runbook.

## Useful commands

| Need | Run |
| --- | --- |
| First run or native/config change | `just mobile rebuild` |
| Everyday JS/TS development | `just mobile run` |
| Format, lint, build API types, typecheck, test, and export | `just mobile check` |
| Run Maestro evidence | `just mobile maestro [flow-or-directory]` |
| Publish an approved JS-only OTA | `just mobile update "<message>"` |

## Testing

Use the canonical `just mobile maestro` runner for iOS simulator evidence. It
starts the installed development client in E2E mode, checks Java 17 and
simulator prerequisites, authenticates the test app, and runs the requested
flows. Individual flows assume that authenticated baseline.

User-visible interaction changes require Maestro evidence and visual inspection
of each changed acceptance state. Type checks and unit tests supplement, but do
not replace, that evidence. See [AGENTS.md](AGENTS.md) for the simulator,
Maestro, and E2E authentication runbook.
