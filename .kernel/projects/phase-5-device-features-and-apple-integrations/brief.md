# Project Brief

## Goal

Phase 5 — Device Features and Apple Integrations

## Target Date

No date

## Context

Phase 5 ports the hardware-driven and Apple-platform-specific surfaces that make the iOS client more than a generic shell. This includes media capture, speech flows, device protections, telemetry parity, and app-intent and widget integration.

Current state: camera, voice input, transcription, text-to-speech, app lock, screenshot prevention, analytics boot, review prompts, intent donation, and the Control Center widget all either live in Expo or are split between Expo and partial native code.

When Phase 5 is done: the native app supports the camera, voice, speech output, biometric and screenshot protections, telemetry parity, shortcuts donation, app intents, and Control Center widget behavior required for full Apple-platform parity.

Completing Phase 5 unlocks: final rollout readiness in Phase 6 because the platform-specific surfaces and metrics needed for gating are in place.

## Scope

### In scope

- Native camera capture, audio recording, waveform presentation, transcription, and text-to-speech behavior used by chat and composer flows
- Native app lock, screenshot prevention, notification and review-prompt behavior, analytics parity, and startup metrics
- Native shortcut donation, app intents package, app groups coordination, and Control Center widget integration
- Variant-safe entitlements and target wiring needed for Apple-specific surfaces

### Out of scope

- Core auth, inbox, notes, chat, and composer flows except where they host device-feature behavior
- Production rollout gates, cutover, and Expo retirement

## Success Criteria

This project is complete when:

- [ ] Camera, voice input, and speech output work inside the migrated product flows
- [ ] App lock and screenshot prevention remain configurable from settings and behave like the current app
- [ ] Siri shortcuts and the Control Center widget open the correct native destinations
- [ ] Telemetry and performance instrumentation are stable enough for rollout gating
- [ ] All milestones are delivered and marked done

## Milestones

1. **5.1 — Media parity** (target: TBD): native camera, audio capture, voice transcription, and text-to-speech parity are achieved for the product flows that use them.
2. **5.2 — Device control and telemetry parity** (target: TBD): app lock, screenshot prevention, notifications, review prompt, analytics, and startup metrics match current behavior.
3. **5.3 — Apple integration parity** (target: TBD): app intents, shortcut donation, app groups, and Control Center widget parity are achieved.

## Stakeholders

| Stakeholder | Role     | What They Care About                                                      |
| ----------- | -------- | ------------------------------------------------------------------------- |
| Mobile team | DRI      | Native platform fidelity, entitlement safety, and reliable media behavior |
| End users   | Informed | High-trust device behavior and polished Apple-platform integrations       |

## Constraints

- Entitlements and app-group behavior must stay aligned across all variants and targets
- Media parity must be validated in the real product hosts, not only isolated demos
- Telemetry semantics must remain comparable to the Expo app so Phase 6 has meaningful gates

## Dependencies

- Phase 4 composer and chat surfaces must exist so media flows have a host
- Phase 1 variant and entitlement setup must already be stable
