# Project Brief

## Goal

Phase 0 — Discovery and Baseline

## Target Date

No date

## Context

This project backfills the discovery work already captured in `apps/mobile/docs/swift-migration/` and makes it explicit in the kernel hierarchy. Its job is to turn the migration from an intention into a governed program with measurable parity gates.

Current state: the surface inventory, parity matrix, and phase documents already exist, but the migration still needs a formal kernel project for scope freeze, contract freeze, baseline evidence, and governance.

When Phase 0 is done: every in-scope surface has a documented owner phase, the backend and client contracts to preserve are recorded, baseline evidence exists for the current Expo behavior, and the migration team has a clear review gate for later phase exits.

Completing Phase 0 unlocks: Phase 1 and every later phase, because the rest of the initiative depends on parity being defined before implementation work proceeds.

## Scope

### In scope

- Approved surface inventory covering routes, shared UI domains, hooks, services, native modules, tests, and release surfaces
- Final parity matrix assigning every major surface to a migration phase and milestone
- Contract inventory for backend APIs, auth semantics, deep links, analytics events, storage formats, notifications, and release variants
- Baseline evidence pack for launch, auth, onboarding, inbox, notes, chat, settings, media, intents, and widget behavior
- Native feasibility decisions for architecture, storage, network stack, and test strategy
- Governance rules for review ownership, dual-run acceptance, and phase exit sign-off

### Out of scope

- Native app implementation work
- Product-surface parity delivery in SwiftUI
- Release automation and production cutover
- Deleting or retiring any Expo code

## Success Criteria

This project is complete when:

- [ ] Every row in `apps/mobile/docs/swift-migration/parity-matrix.md` is assigned to a phase and milestone
- [ ] No route, service, native target, or release surface is missing from `apps/mobile/docs/swift-migration/surface-inventory.md`
- [ ] Launch, sign-in, onboarding, inbox, notes, chat, settings, media, intents, and widget flows all have baseline evidence captured from the current app
- [ ] The migration team agrees that backend and mobile semantics are stable enough to port without moving the target during implementation
- [ ] Native architecture choices are recorded before Phase 1 execution proceeds
- [ ] All milestones are delivered and marked done

## Milestones

1. **0.1 — Surface inventory and scope freeze** (target: TBD): approve the migration surface list and confirm no uncovered route, service, or native target remains.
2. **0.2 — Contract freeze and architecture decisions** (target: TBD): record the API, auth, deep-link, analytics, storage, and release contracts the native app must preserve.
3. **0.3 — Baseline evidence and governance** (target: TBD): capture behavioral evidence for current app flows and define review and acceptance gates for later phases.

## Stakeholders

| Stakeholder        | Role      | What They Care About                                                                       |
| ------------------ | --------- | ------------------------------------------------------------------------------------------ |
| Mobile team        | DRI       | Complete scope definition, realistic migration risks, and parity gates that prevent rework |
| Backend team       | Consulted | Stable API and auth contracts that will not drift mid-migration                            |
| Product leadership | Approver  | Confidence that parity claims are grounded in evidence and gated before cutover            |

## Constraints

- The Expo app remains the reference implementation for all captured behaviors
- Discovery output must stay aligned with `apps/mobile/docs/swift-migration/README.md`, `surface-inventory.md`, and `parity-matrix.md`
- No later phase can claim parity on undocumented behavior
- Phase 0 documents what and why, not implementation details for SwiftUI delivery

## Dependencies

- Access to the current mobile app flows on device or simulator for evidence capture
- Access to backend contract owners for API and auth validation
- Agreement on the phase-exit approval path before implementation expands
