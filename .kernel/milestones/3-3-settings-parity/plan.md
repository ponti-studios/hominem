# Milestone Plan

## Goal

3.3 — Settings parity

## Approach

Deliver the main settings surface and account-management behaviors first, then layer archived-session access and device-preference settings on top. This keeps the milestone anchored in account correctness before it expands into broader device-control behavior.

## Work Item Breakdown

| Work Item                                          | Purpose                                                                              | Depends On                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------- |
| settings-account-and-passkey-management            | Settings route, account editing, and passkey-management wiring                       | none                                    |
| archived-sessions-app-lock-and-screenshot-settings | Archived-session access plus settings parity for app-lock and screenshot preferences | settings-account-and-passkey-management |

## Critical Path

`settings-account-and-passkey-management` is the bottleneck because the account surface and auth-linked settings must be stable before archived-session and device-preference behavior build on it.

## Sequencing Rationale

Account and passkey settings come first because they define the core settings surface and its relationship to auth state. Archived sessions and device-preference toggles follow once the settings host is stable.

## Deliverables

- Native settings route with account-editing and passkey surface wiring
- Archived-session access and resume behavior
- Settings-surface parity for app-lock and screenshot preferences

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Account, archived-session, and settings preference flows are verified on device
- [ ] Phase 3 ends with daily-use non-chat surfaces stable in native

## Risks

| Risk                                                                            | Likelihood | Impact | Mitigation                                                                    |
| ------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------- |
| Settings uses auth state differently than other surfaces                        | Med        | High   | Validate settings behavior against Phase 2 auth foundations during review     |
| Preference toggles are wired before their later host implementations are stable | Med        | Med    | Scope this milestone to settings-surface parity and defer deeper device logic |

## Open Questions

- Which passkey-management behaviors must be truly functional now versus surfaced as parity placeholders? Owner: mobile team. Deadline: before the account-settings work exits.
- What archived-session resume outcomes are mandatory for daily-use sign-off? Owner: mobile team. Deadline: before milestone review.
