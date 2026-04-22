# Milestone Plan

## Goal

5.3 — Apple integration parity

## Approach

Define the system-entry and shared-data contract first, then wire the Control Center widget and extension targets on top of it. App-intent and widget implementation can overlap once the destination vocabulary and app-group contract are drafted, but milestone sign-off requires explicit cross-variant validation after both work items close.

## Work Item Breakdown

| Work Item                                            | Purpose                                                       | Depends On                                           |
| ---------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| app-intents-shortcut-donation-and-app-groups         | App intents, shortcut donation, and shared app-group behavior | Stable route vocabulary and Phase 1 entitlements     |
| control-center-widget-routing-and-target-integration | Widget routing, target wiring, and variant-safe integration   | Stable app-group contract and destination vocabulary |

## Critical Path

`app-intents-shortcut-donation-and-app-groups` is the bottleneck because widget routing is only safe once the shared destination and app-group contract is explicit.

## Sequencing Rationale

App intents and app groups still define the contract, but the widget implementation does not need to wait for every intent edge case to be archived before target wiring begins. The real gate is whether the shared contract is stable enough that both surfaces can be validated across all variants without rework.

## Deliverables

- App intents, shortcut donation, and app-group coordination
- Control Center widget routing and variant-safe target integration
- Apple-platform entry points ready for rollout validation

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] System entry points route correctly on device and across required variants
- [ ] Apple integration behavior is stable enough for Phase 6 validation

## Risks

| Risk                                                        | Likelihood | Impact | Mitigation                                                           |
| ----------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Widget integration is correct in one variant but not others | Med        | High   | Validate every required variant and target pairing during review     |
| App-group coordination semantics are underspecified         | Med        | High   | Define the shared-data contract explicitly before widget work closes |

## Open Questions

- Which widget interactions are required for parity sign-off versus acceptable follow-up behavior? Owner: product leadership. Deadline: before widget work exits.
- What exact shared-data contract must app intents and widget targets rely on? Owner: mobile team. Deadline: before milestone review.
