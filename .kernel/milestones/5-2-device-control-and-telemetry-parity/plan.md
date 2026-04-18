# Milestone Plan

## Goal

5.2 — Device control and telemetry parity

## Approach

Start device-control and telemetry work once settings parity and lifecycle hooks are stable. The two work items can proceed in parallel on top of the same foundations, but Phase 5 should not exit until telemetry semantics are stable enough for Phase 6 rollout gates to trust.

## Work Item Breakdown

| Work Item                                   | Purpose                                                      | Depends On                                            |
| ------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| app-lock-screenshot-review-prompt-parity    | App lock, screenshot prevention, and review-prompt parity    | 3.3 settings parity                                   |
| notifications-analytics-and-startup-metrics | Notification behavior, analytics parity, and startup metrics | 1.2 observability foundations and 3.3 settings parity |

## Critical Path

`notifications-analytics-and-startup-metrics` is the bottleneck because Phase 6 rollout gating depends on trustworthy native metrics and lifecycle signals.

## Sequencing Rationale

App lock and screenshot behavior should not unnecessarily block telemetry work, because they share settings and lifecycle foundations but solve different risks. The milestone closes only after both user-facing controls and rollout-facing telemetry are verified against Expo and approved by the right owners.

## Deliverables

- Native app lock, screenshot prevention, and review-prompt behavior
- Notification handling and lifecycle analytics parity
- Startup metrics and telemetry stable enough for rollout gating

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Device-control behavior and telemetry are verified on device against Expo
- [ ] Phase 6 can use the native metrics and controls as rollout inputs

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                          |
| -------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------- |
| Device controls appear wired in settings but not enforced at runtime | Med        | High   | Validate end-to-end behavior from settings toggle to runtime effect |
| Telemetry parity is confused by variant or lifecycle differences     | Med        | High   | Verify metrics and event tagging per variant before closure         |

## Open Questions

- Which notification and review-prompt behaviors are required for parity sign-off versus acceptable follow-up scope? Owner: product leadership. Deadline: before milestone review.
- What exact startup metrics must be preserved for Phase 6 gating? Owner: engineering leadership. Deadline: before telemetry work exits.
