# Initiative Brief

## Goal

swift-migration

## Why This Matters

The Expo app is the current production iOS client. It works, but React Native imposes a ceiling on what's buildable at the performance, hardware-integration, and App Store capability level. The migration removes that ceiling: native SwiftUI gives full access to Apple's platform — Shortcuts, Control Center widgets, Face ID, app intents, and first-class performance for the camera, voice, and transcription stack.

The cost of inaction: every new Apple platform feature requires a bespoke Expo native module, every performance improvement is bottlenecked by the JS bridge, and the widget/intents surface that's already partially built in Swift has no first-class shell to live in.

## Strategic Objective

Deliver a native Swift iOS app with verified 1:1 parity across all 60 surfaces in `docs/swift-migration/parity-matrix.md`, ship it to production, confirm stability, and retire the Expo client. The Expo app must remain the reference implementation and must not be deleted until each surface has passing exit evidence.

## Scope

### In scope

- All 60 surfaces defined in `docs/swift-migration/parity-matrix.md`
- All 4 app variants: dev (`com.pontistudios.hakumi.dev`), e2e, preview, production (`com.pontistudios.hakumi`)
- Auth: email OTP, passkeys, session recovery, boot sequence edge cases
- Protected shell: routing, onboarding, tab layout, app lock, screenshot prevention
- Inbox, notes, settings, chat, composer, attachments, drafts
- Camera, voice/transcription/TTS, biometrics (Face ID)
- App Shortcuts, app intents, Control Center widget
- Push notifications, review prompts, PostHog analytics, startup instrumentation
- Native test suite and CI/release automation (Phase 6)

### Out of scope

- Web fallback (`app/+html.tsx`) — remains in Expo, not migrated
- Android — iOS only for this initiative
- Net-new features — parity only, no additions during migration
- Backend API changes — the API contract is frozen for the duration of the migration

## Success Criteria

This initiative is complete when:

- [ ] All 60 parity-matrix surfaces have passing exit evidence documented and accepted
- [ ] The native app has been shipped to production and passed the post-cutover stability threshold
- [ ] The Expo codebase has been deleted or archived from the monorepo
- [ ] A migration retrospective has been written at `kernel/retrospectives/`

## Key Projects

1. **Phase 0 — Discovery and Baseline** (`.kernel/projects/phase-0-discovery-and-baseline`): Freeze scope, document contracts, capture baseline evidence, and establish migration governance.
2. **Phase 1 — Native Foundation** (`.kernel/projects/phase-1-native-foundation`): App bootstrap, variant configuration, design system, routing shell, and observability. No feature work can start until this ships.
3. **Phase 2 — Auth and Shell** (`.kernel/projects/phase-2-auth-and-shell`): Email and passkey auth, session bootstrap, onboarding, protected routing, and tab shell.
4. **Phase 3 — Inbox, Notes, and Settings** (`.kernel/projects/phase-3-inbox-notes-and-settings`): Core browse, edit, and account-management surfaces plus the native data layer.
5. **Phase 4 — Chat, Composer, and Files** (`.kernel/projects/phase-4-chat-composer-and-files`): Conversations, global composer, mentions, drafts, uploads, and attachment flows.
6. **Phase 5 — Device Features and Apple Integrations** (`.kernel/projects/phase-5-device-features-and-apple-integrations`): Camera, voice, biometrics, telemetry parity, app intents, and widget work.
7. **Phase 6 — Hardening, Cutover, and Retirement** (`.kernel/projects/phase-6-hardening-cutover-and-retirement`): Validation, rollout gates, parallel run, cutover, and Expo retirement.

## Stakeholders

| Stakeholder | Role     | What They Care About                                               |
| ----------- | -------- | ------------------------------------------------------------------ |
| Mobile team | DRI      | Delivering parity without breaking the live Expo app in production |
| End users   | Informed | Seamless experience — the migration must be invisible to them      |

## Timeline

- No fixed initiative target date
- Phase 0 is treated as complete in substance and is being backfilled as a kernel project artifact
- Phase 1 already exists as the first active project in the hierarchy
- Phases 2 through 6 remain strictly gated by prior phase exit criteria rather than calendar commitments

## Risks and Assumptions

| Item                                                                      | Type       | Mitigation                                                                                   |
| ------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Hidden auth complexity — boot sequence edge cases are underdocumented     | Risk       | Spike auth contracts and write explicit state machine docs before Phase 2 starts             |
| Composer coupling to route shell is deeper than the surface map shows     | Risk       | Treat composer as a standalone module with a defined interface; do not embed it in the shell |
| Entitlement drift across main app, intents module, and widget targets     | Risk       | Single source of truth for entitlements config; all targets derive from it                   |
| SwiftUI scroll anchoring for top-anchored feeds is harder than RN         | Risk       | Prototype in Phase 1 infra; do not defer to Phase 3 discovery                                |
| Audio transcription/TTS requires native platform work beyond library swap | Risk       | Spike in Phase 1 or early Phase 5; do not assume it's a drop-in replacement                  |
| Passkey behavior may drift from Better Auth implementation                | Assumption | Validate exact passkey API contract before Phase 2 implementation begins                     |
| Backend API contract is stable for the migration duration                 | Assumption | Pin API versions; any breaking change must be flagged and assessed immediately               |
