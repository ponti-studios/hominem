# Project Plan

## Goal

Phase 5 — Device Features and Apple Integrations

## Approach

Build the Apple-specific layer around one critical path and two overlapping lanes: media and speech remain the Phase 5 bottleneck, while device controls and telemetry can begin once settings and lifecycle hooks are stable, and Apple integration can begin once route, entitlement, and app-group contracts stop moving. All work is validated in the real host flows created by earlier phases rather than in isolation.

The core bet is that Phase 5 should not serialize behind media closeout when the supporting contracts for telemetry and Apple entry points are already stable.

## Milestone Breakdown

| Milestone | Purpose                                                                                                       | Depends On                                            | Target Date |
| --------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------- |
| 5.1       | Deliver camera, audio capture, transcription, and text-to-speech parity in product hosts                      | phase-4-chat-composer-and-files                       | TBD         |
| 5.2       | Deliver app lock, screenshot prevention, notifications, review prompts, analytics parity, and startup metrics | 3.3 settings parity and 1.2 observability foundations | TBD         |
| 5.3       | Deliver app intents, shortcut donation, app groups, and Control Center widget parity                          | Phase 1 entitlements and stable native routes         | TBD         |

## Critical Path

Milestone 5.1 is the bottleneck because it proves the native media stack inside real product flows. If media behavior is unstable, the later telemetry and Apple-integration work may still progress, but Phase 5 cannot close or hand trustworthy behavior into rollout.

## Sequencing Rationale

Media comes first because it is the highest-risk hardware behavior and depends directly on the conversation hosts built earlier. Device controls and telemetry can proceed once settings and lifecycle hooks are stable. App intents and widget work can proceed once route and entitlement contracts are stable. Final Phase 5 sign-off still waits for all three milestones to converge and validate across variants.

## Risks

| Risk                                                                              | Likelihood | Impact | Mitigation                                                                                          |
| --------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| Audio and transcription parity requires deeper native platform work than expected | Med        | High   | Spike recording, transcription, and playback behavior inside host flows before broad rollout        |
| Widget, app-intent, and app-group behavior drifts across variants                 | Med        | High   | Keep entitlements and app-group configuration centralized and verify every variant before 5.3 exits |
| Media UX regressions block adoption despite nominal feature parity                | Med        | Med    | Validate flows on real devices with the same interaction patterns used in production                |

## Acceptance Criteria

This project is complete when:

- [ ] All milestones are done
- [ ] Media, device-control, telemetry, and Apple integration behavior are proven inside migrated product flows
- [ ] Variant-specific entitlements and app-group wiring are verified for all required targets
- [ ] Phase 6 rollout gates have stable telemetry and platform surfaces to depend on

## Open Questions

- Which transcription and speech stack best matches current product expectations while meeting Apple-platform requirements? Owner: product leadership and mobile team. Deadline: before 5.1 exits.
- What is the exact shared-data contract between the main app and the Control Center widget? Owner: mobile team. Deadline: before 5.3 exits.
- How should notification behavior differ, if at all, across dev, preview, and production variants? Owner: product leadership. Deadline: before 5.2 exits.
