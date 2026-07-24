# V. Operations

The system is only real when a clean checkout, a deployment, and a production
failure all behave as deliberately as local development.

## Developer law

- `just` is the only repository-level command interface. Package scripts are
  Turbo primitives, not contributor instructions.
- Run the smallest relevant validation lane first: `just check api`,
  `just check mobile`, `just check career`, or `just check finance`.
- Source-first workspace exports are the local-development model. Production
  deployables build explicit artifacts; stale `build/` directories are never a
  second source of truth.
- One Node and pnpm line governs local development, CI, Docker, Railway, and
  EAS. Version drift is a defect.
- `@hominem/env` owns shared environment semantics. Framework prefixes adapt a
  variable for a runtime; they do not invent a second meaning.

## Evidence law

Completion is conditional on evidence of the exact changed behavior in its
real execution environment. Compilation, formatting, type checks, builds, and
broad test suites are supporting evidence only; they do not prove a visible
interaction, a layout, an external side effect, or a deployment result.

| Changed behavior | Required evidence |
| --- | --- |
| Pure computation or contract | Targeted test that asserts the changed input/output contract. |
| User-visible or interactive behavior | Target device/browser evidence for each changed state and transition. |
| Constrained composition | Verification at the smallest supported viewport, device, or container. |
| External write or deployment | Observation of the resulting external state and target identity. |
| Framework/library capability | Minimal working proof of the exact capability before feature work depends on it. |

- A stateful interaction is not verified by its idle render. Evidence covers
  entry, active/focused/loading state, cancellation or failure when applicable,
  and return or recovery.
- A failed, skipped, ambiguous, stale-build, or non-targeted validation leaves
  the change unverified. It is a blocker, not a warning to explain away.
- Before composing controls in a bounded surface, prove the complete
  composition fits. If the approved behavior does not fit in the chosen
  primitive, report the constraint and stop; do not silently change product
  behavior.
- Automation must have a deterministic selection and observation path for
  app-owned controls and outcomes. If it does not, resolve the testability gap
  or report it before completion.
- A completion report names the evidence, its scope, and any behavior that
  remains unverified. It never substitutes an assumed result for evidence.

## Deployment law

Every production service has one deployment authority. A GitHub-managed Railway
service must not also use Railway linked-source auto-deploy.

A deployment target is one versioned tuple:

```text
repository + logical service + immutable Railway service ID
+ checked-in configuration path + triggering workflow
```

Upload acceptance is not deployment success. Automation verifies the resolved
target identity and the final remote deployment state.

## Omiro mobile delivery

Omiro uses Expo Continuous Native Generation. The checked-in source of truth is
the app config, local Expo Modules, and config plugins; `apps/omiro/ios` is
generated output and is excluded from Git and EAS uploads.

The release path is deliberately linear:

```text
local development client -> production TestFlight candidate -> phased App Store release
```

TestFlight candidates and App Store releases use the same production bundle,
backend, update channel, and native binary. There is no separate staging
binary. Production releases are manual GitHub workflow dispatches protected by
the `omiro-testflight` and `omiro-production` environments. The old automatic
`main`-to-store path is prohibited.

The marketing version is committed in app config and is the EAS Update runtime
version. EAS remotely increments only the iOS build number. A native
compatibility fingerprint is recorded in the release manifest and must match
before an OTA update can be published.

Production OTA updates are manually rolled out at 10%, 50%, and 100%, with
rollback available at every stage. Native changes require a new TestFlight
candidate and App Store release.

### Omiro Sentry native build phases

`@sentry/react-native`'s Expo config plugin adds two separate Xcode Run Script
phases to the archive, each of which shells out to `@sentry/cli`:

- **"Bundle React Native code and images"** (`sentry-xcode.sh`) — uploads JS
  sourcemaps during the Metro bundle step.
- **"Upload Debug Symbols to Sentry"** (`sentry-xcode-debug-files.sh`) —
  uploads native dSYMs during archive, after linking.

`@sentry/cli` is only a transitive dependency of `@sentry/react-native`, and
pnpm's strict `node_modules` does not expose transitive dependencies to
sibling packages by default — plain `require.resolve('@sentry/cli/package.json')`
from `apps/omiro/ios` is not guaranteed to find it.

- **On `@sentry/react-native@8.x` (current)**: both scripts resolve via
  `require.resolve('@sentry/cli/package.json', { paths: [require.resolve('@sentry/react-native/package.json')] })`
  — walking up from `@sentry/react-native`'s own install location, which finds
  its nested `@sentry/cli` regardless of pnpm's isolation. Every resolution
  attempt is wrapped in `2>/dev/null || true`, with a PNPM-shim-parsing
  fallback if it still comes up empty, so a resolution failure degrades to a
  build warning instead of aborting the archive.
- **On `@sentry/react-native@7.x`**: neither script had this fix.
  `sentry-xcode-debug-files.sh` in particular called plain
  `require.resolve('@sentry/cli/package.json')` **unconditionally, without
  `2>/dev/null` or `|| true`**, before ever checking `SENTRY_DISABLE_AUTO_UPLOAD`
  — if unresolvable, `require.resolve` threw, `set -e` propagated that as a
  hard archive failure, and it happened *before the disable flag was ever
  read*. This is what broke Omiro's production builds. Upgrading to 8.x fixed
  it upstream; the 7.x-era workaround was declaring `@sentry/cli` as a direct
  `devDependency` in `apps/omiro/package.json` so plain `require.resolve`
  succeeded without the `{ paths }` fix. That devDependency pin is still in
  place (kept in sync with whatever `@sentry/react-native` pins internally,
  currently `@sentry/cli@3.6.1`) as defense-in-depth, but is no longer load
  bearing on 8.x — the upstream resolution fix covers it independently.

Required for this to work end to end, all set as EAS environment variables
(`eas env:list <environment>`), not GitHub secrets:

- `SENTRY_ORG`, `SENTRY_PROJECT` — set directly in `eas.json`'s `build.base.env`.
- `SENTRY_AUTH_TOKEN` — EAS secret, all three EAS environments.
- `EXPO_PUBLIC_SENTRY_DSN` — EAS var, all three EAS environments; read directly
  via `process.env.EXPO_PUBLIC_SENTRY_DSN` in `apps/omiro/services/observability.ts`
  (not routed through `app.config.ts`'s `extra`).

With `@sentry/cli` now resolvable, `SENTRY_DISABLE_AUTO_UPLOAD` has been
removed from `build.base.env` — sourcemaps and dSYMs upload again on
production builds, so crashes are symbolicated in Sentry. If a future Sentry
build-phase failure needs a quick unblock, re-adding this flag is a stopgap
at best: it does not protect against the `@sentry/cli` resolution failure
above, only against the upload call after resolution succeeds.

## Production safety

- `AUTH_TEST_OTP_ENABLED` is explicitly `false` in production.
- A successful OTP request does not prove mail delivery. Check deployment,
  `/api/status`, aggregate HTTP patterns, the production flag, and the provider
  path without logging OTPs or tokens.
- Do not casually rotate `BETTER_AUTH_SECRET`; it signs live session cookies.
- Production investigation uses aggregate session counts and expiry through an
  approved database tunnel. It never retrieves user records, session tokens,
  cookies, OTPs, or credentials.
- Logs redact secrets and avoid raw third-party URLs when a safer identifier
  exists.

## Bible law

The root README is the front door. This directory contains the five parts of
the Bible. Durable product, system, experience, voice, and operational laws
belong in their part; temporary execution belongs in the work tracker; local
implementation detail belongs in code.

When a change alters a durable law, update the relevant part in the same pull
request. Delete statements that are no longer true. The Bible explains the
system as it exists now.
