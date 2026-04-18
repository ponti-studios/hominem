# Initiative Plan

## Goal

swift-migration

## Strategic Approach

The migration is structured as a gated phase progression: no phase starts until the previous phase's exit criteria are verified. This prevents integration debt from accumulating across a long migration timeline.

The core bet is that SwiftUI-first architecture will reach parity faster than a hybrid approach. UIKit escape hatches are permitted only where SwiftUI cannot deliver the required behavior (e.g., custom camera overlays, certain scroll anchoring patterns). All escape hatches must be documented at creation time with a justification and a path back to SwiftUI.

The Expo app is the reference implementation throughout. It must remain running in production, unchanged, until Phase 6 completes the cutover. Every surface in the native app must have a corresponding entry in the parity matrix with passing exit evidence before the Expo client is retired.

Seven projects map to phases 0 through 6. Phase 0 backfills the discovery and contract freeze work already captured in `apps/mobile/docs/swift-migration/`. Phases 1 through 4 are strictly sequential: each phase's output is a prerequisite for the next. Phase 5 can be parallelized against Phase 4 after the Phase 3 data layer stabilizes. Phase 6 is the cutover gate.

## Project Breakdown

| Project                                        | Purpose                                                                                             | Depends On                                                                                    | Target Date |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------- |
| phase-0-discovery-and-baseline                 | Surface inventory, parity freeze, contract documentation, baseline evidence, and governance gates   | none                                                                                          | TBD         |
| phase-1-native-foundation                      | Native Xcode project, variant config, design system, routing shell, telemetry bootstrap             | phase-0-discovery-and-baseline                                                                | 2025-06-30  |
| phase-2-auth-and-shell                         | Email OTP, passkeys, boot sequence state machine, onboarding, protected shell, app lock foundations | phase-1-native-foundation                                                                     | TBD         |
| phase-3-inbox-notes-and-settings               | Inbox, notes, settings, archived sessions, and native data layer                                    | phase-2-auth-and-shell                                                                        | TBD         |
| phase-4-chat-composer-and-files                | Chat UI, global composer, mentions, attachments, drafts, and upload flows                           | phase-3-inbox-notes-and-settings                                                              | TBD         |
| phase-5-device-features-and-apple-integrations | Camera, voice/TTS, app lock and screen-capture parity, app intents, Control Center widget           | phase-4-chat-composer-and-files or parallel after phase-3-inbox-notes-and-settings stabilizes | TBD         |
| phase-6-hardening-cutover-and-retirement       | Test automation, parallel run, rollout gates, cutover, and Expo retirement                          | all prior phases complete                                                                     | TBD         |

## Critical Path

Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 6.

Phase 0 is the prerequisite bottleneck for planning quality, and Phase 1 is the delivery bottleneck. Until the migration surface inventory, contracts, and baseline pack are accepted, there is no reliable reference for parity. Until the native Xcode project exists with all variants configured, signed, and launching on real devices, no feature work can begin. A slip in either phase propagates directly to every subsequent phase.

Phase 2 is the second bottleneck. Auth and boot sequence edge cases are the highest-risk work in the entire initiative — underdocumented state machines, passkey behavior drift from Better Auth, and session recovery corner cases all live here. Phase 3+ cannot host real product without a working auth layer.

Phase 3 introduces the native data layer. Without it, Phases 4 and 5 have no reliable way to fetch, cache, or sync data. The data layer architecture decision (TCA + async/await vs. Observation + @Observable) must be made and locked before Phase 3 begins.

## Sequencing Rationale

**Phase 0 first**: The migration needs a frozen inventory, contract record, and baseline evidence set before implementation begins. Without that, parity becomes subjective and later acceptance is unstable.

**Phase 1 second**: No feature work can happen without a buildable Xcode project. The design system and routing shell must exist before any surface can be ported. Telemetry must boot before any surface — otherwise parity comparison data is blind from the start.

**Phase 2 before everything**: Every product surface requires a logged-in user. Auth is the gate. The boot sequence state machine (cold start → token check → session recovery → onboarding vs. main shell) is load-bearing for every phase that follows.

**Phase 3 before Phase 4**: The inbox and notes surfaces are simpler than chat but use the same data-layer patterns. Phase 3 establishes the data layer contract that Phase 4's composer and attachment system will depend on. Building Phase 4 on an unvalidated data layer would create rework.

**Phase 5 parallelizable**: Hardware integrations (camera, voice, widget) do not share a critical dependency with Phase 4's UI surfaces. Once the data layer and shell exist, Phase 5 work can proceed alongside Phase 4 completion.

**Phase 6 last and gated**: Cutover is destructive — retiring Expo removes the safety net. All 60 parity-matrix surfaces must have passing exit evidence, the native app must survive a parallel production run, and rollout gates must pass before the Expo client is deleted.

## Success Criteria

This initiative is complete when:

- [ ] All 60 parity-matrix surfaces have passing exit evidence documented and accepted
- [ ] The native app has been shipped to production and passed post-cutover stability threshold (crash-free rate ≥ Expo baseline, p95 startup ≤ Expo baseline)
- [ ] The Expo codebase has been deleted or archived from the monorepo
- [ ] All projects (Phases 0–6) are marked done
- [ ] A migration retrospective has been written at `kernel/retrospectives/hakumi-ios-migration.md`

## Risks

| Risk                                                                                     | Likelihood | Impact | Mitigation                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Auth boot sequence complexity exceeds estimates — underdocumented state machines in Expo | High       | High   | Spike auth contracts and write an explicit state machine doc before Phase 2 begins; treat unknown states as blockers, not edge cases |
| Passkey behavior drifts from Better Auth implementation                                  | Med        | High   | Validate exact passkey API contract with backend team before Phase 2 implementation; document deviations immediately                 |
| SwiftUI scroll anchoring for top-anchored feeds is harder than React Native              | Med        | High   | Prototype `scrollPosition(id:anchor:)` in Phase 1 infra spike; do not defer to Phase 3 discovery                                     |
| Composer coupling to route shell is deeper than surface map shows                        | Med        | High   | Treat composer as a standalone module with a defined interface; do not embed in the tab shell                                        |
| Entitlement drift across main app, intents module, and widget targets                    | Med        | Med    | Single source of truth for entitlements config (xcconfig or custom build setting); all targets derive from it                        |
| Audio transcription/TTS stack requires native platform work beyond library swap          | Med        | High   | Spike audio pipeline in Phase 1 or early Phase 5; do not assume AVFoundation + Speech framework is a drop-in replacement for Expo AV |
| Phase 1 timeline slip cascades to all phases                                             | High       | High   | Phase 1 has a hard target of 2025-06-30; weekly milestone check; escalate if more than one milestone unit slips                      |
| Backend API contract breaks during migration                                             | Low        | High   | Pin API versions; any breaking change must be flagged and assessed immediately; backend changes require explicit coordination        |
| Token drift between Expo theme and native design system                                  | Med        | Med    | Lock color, spacing, and typography tokens from Expo source before Phase 1 design system work begins; no ad-hoc values               |

## Open Questions

- **SwiftUI architecture pattern**: TCA (The Composable Architecture) vs. Observation + @Observable + async/await? Must be decided before Phase 2 begins. Owner: mobile team lead. Deadline: before Phase 1 exits.
- **Minimum iOS version**: iOS 15.1 confirmed as minimum — validate that all SwiftUI APIs used in the design system (NavigationStack, etc.) are available on iOS 16+, or bump minimum to 16. Owner: mobile team. Deadline: Phase 1 Milestone 1.1.
- **UIKit escape hatch policy**: What is the documented threshold for using UIKit inside SwiftUI? Needs a written decision record before Phase 2. Owner: mobile team lead. Deadline: Phase 1 exit.
- **Passkey API contract**: Exact Better Auth passkey flow and expected credential format. Owner: backend team. Deadline: before Phase 2 starts.
- **PostHog event taxonomy**: Are existing Expo PostHog events reused as-is, or is migration an opportunity to clean up the event schema? Affects Phase 1 observability work. Owner: mobile team. Deadline: Phase 1 Milestone 1.2.
