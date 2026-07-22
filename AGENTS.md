## Rules

- Follow YAGNI (You Aren't Gonna Need It) principle and one-liner solutions whenever possible.
- Never commit code. The user must review and commit the changes themselves.
- `apps/omiro` should only support Apple devices. Do not add fallbacks for other platforms such as Android.

## Product and architecture authority

- The user is the product manager and software architect. The assistant must not invent, infer, or silently select product behavior, information architecture, navigation hierarchy, route ownership, or platform architecture.
- Treat user-stated product intent, approved PRDs, approved specs, and existing governing Bible rules as authoritative. If they conflict or leave an architectural choice open, stop and ask the user; do not resolve the conflict by choosing an architecture.
- Before changing architecture, compare the proposed change against the current spec and explicitly report any mismatch. Implementation authority does not include product-decision authority.
- Never rewrite a PRD, spec, plan, or task list to justify an implementation choice that the user did not approve. Mark unresolved decisions as `OPEN — USER DECISION REQUIRED`.
- If implementation work reveals that the approved architecture cannot be expressed with the chosen library, report the constraint and alternatives without selecting one.

## Evidence before completion

- A change is complete only when its validation proves the exact behavior that changed in the environment where that behavior runs. Type checks, linting, a build, or unrelated tests are supporting evidence; none proves a user interaction, visual layout, external side effect, or deployment outcome.
- Select validation from the risk, not from habit: verify user-visible or interactive changes on the target device/browser; verify external writes against the resulting external state; verify library/framework assumptions with a minimal working proof before building a feature on them.
- For stateful interactions, test every affected state and transition, including entry, active/focused or loading state, cancellation or failure, and return to the prior state. A control that renders is not validated until its action and resulting state are observed.
- Before composing controls into a constrained surface, prove that the full composition fits at the smallest supported viewport, device, or container. If the chosen primitive cannot meet the approved behavior within those constraints, stop and report the limitation; do not improvise a different product behavior.
- Treat a failed, skipped, ambiguous, stale-build, or non-targeted validation as a blocker. State exactly what remains unproven. Never call work done, update acceptance tests as though it passed, or claim a result based on a test that did not exercise the changed behavior.
- Automation needs a deterministic observation path. If an app-owned control or outcome cannot be selected or observed reliably, resolve that testability gap or report it before completion; do not replace it with a fuzzy assertion and call the interaction verified.

## Documentation

- The root `README.md` is the front door to the Hominem Bible ([docs/](docs/)).
- Durable product, architecture, design, security, and operational decisions in the appropriate numbered Bible part under the root `docs/` directory. 
  - Do not create `docs/` directories inside apps, packages, or services.
- Keep package READMEs to setup and local entrypoint information; link to the root Bible for governing decisions.
- Write current rules and invariants, not incident narratives or temporary task lists. Git history preserves history; the work tracker owns temporary execution.
- Update the relevant Bible document in the same change when a durable implementation decision changes.

## Adding a new package, app, or service

- Never add a `workspace:*` dependency in `package.json` for an `import type`-only reference — pnpm/turbo don't know TypeScript erases type-only imports, so a real dependency edge drags the whole target package's build/test/lint/typecheck into every consumer's CI scope. Use a `paths` alias in your own `tsconfig.json` pointing at the real source file instead. See `CLAUDE.md`'s "Adding a new package, app, or service" section for the full checklist (tsconfig composite/references wiring, Dockerfile pattern, `validate-*.yml`/`deploy-*.yml` conventions) before scaffolding a new app.
- A new deployable app's CI workflow must set every env var required by its own code _and_ its transitive `@hominem/*` dependencies — missing one silently breaks CI with an `EnvValidationError`, not an obviously-related error message.

## Expo and EAS

- `apps/omiro` uses Expo managed workflow with Metro package exports enabled.
- Shared ESM packages may use explicit `.js` imports while their source files are TypeScript. Keep the Omiro Metro resolver fallback that retries an explicit `.js` import without the extension so Metro can resolve the source file; do not rewrite shared Node ESM imports just to satisfy Metro.
- With Corepack enabled, do not pin `pnpm` in `apps/omiro/eas.json`. EAS may attempt a conflicting global install and fail with `npm ERR! EEXIST`.
- Verify an EAS fix with the same embed command used by the build: `pnpm --filter @hominem/omiro exec expo export:embed --eager --platform ios --dev false`.

## Production authentication

- Better Auth is the sole authentication authority. Preserve its session database, signed cookies, and native client storage contract.
- `AUTH_TEST_OTP_ENABLED` must be explicitly `false` in production. Its safe default is test-only (`NODE_ENV === 'test'`). When enabled, the API records OTPs in the test store and returns success without sending through Resend.
- A `200` response from the OTP request endpoint does not prove delivery. Check the production flag and the email provider path without logging OTPs, tokens, cookies, or credentials.
- Never rotate `BETTER_AUTH_SECRET` casually. Better Auth signs session cookies with it; changing it can invalidate every stored client session even when the database session rows still exist.
- When investigating a production auth incident, check the API deployment status, `/api/status`, auth HTTP status patterns, the presence of the OTP flag, and aggregate session counts/expiry through an approved Railway database tunnel. Do not retrieve session tokens or user records.

## Testing the omiro app (iOS Simulator)

Use **Maestro** for programmatic UI testing of `apps/omiro`. The app is installed on the booted simulator as `com.pontistudios.hakumi.dev`.

**Prerequisites — Java 17 must be on PATH before running Maestro:**

```bash
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
```

**Launch the app:**

```bash
xcrun simctl launch booted com.pontistudios.hakumi.dev
```

**Take a screenshot:**

```bash
xcrun simctl io booted screenshot /tmp/omiro_screen.png
```

**Run a Maestro flow:**

```bash
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH" && export JAVA_HOME="/opt/homebrew/opt/openjdk@17" && maestro test my_flow.yaml
```

**Maestro flow skeleton:**

```yaml
appId: com.pontistudios.hakumi.dev
---
- launchApp
- assertVisible: 'Omiro'
- tapOn:
    id: 'feed-composer-input' # use testID values from source
- inputText: 'some text'
- takeScreenshot: /tmp/omiro_step
```

Tap targets use the React Native `testID` prop. Key IDs already in the codebase:

- `feed-composer` — the composer shell on the home screen
- `feed-composer-input` — the text input inside the home composer
- `chat-composer` / `chat-composer-input` — same for the chat detail screen

The booted simulator is iPhone 17 Pro (UDID `BD390792-D3EC-4351-BE57-EAF642FABD34`).

**Known issue — always tap by `id`, not by fuzzy text:** iOS's accessibility tree merges all children of a screen (e.g. a bottom sheet) into a single node whenever no text field currently has focus. When that happens, `tapOn: text: '...'` (or the Maestro MCP `tap_on` tool's `text` param) resolves to the center point of that merged node's bounds — which is often the modal backdrop, not the element you meant — and silently dismisses the sheet instead of tapping the target. Tapping by `id` (i.e. the element's `testID`) works reliably regardless of focus state and does not suffer from this merging. Prefer `id` selectors over `text` selectors for anything inside a modal/sheet.

## code style

- if a function only calls a function use `() => <function name>(<args>)` style instead of unnecessary curly braces.
