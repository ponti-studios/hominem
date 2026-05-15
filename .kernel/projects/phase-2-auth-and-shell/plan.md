# Project Plan

## Goal

Phase 2 — Auth and Shell

## Approach

Rebuild the auth domain in dependency order: public sign-in first, session restore and redirect logic second, then protected shell and onboarding behavior. The native shell must preserve the Expo app's routing and session semantics rather than approximating them.

The core bet is that auth correctness matters more than screen count. A smaller but exact auth and shell surface is preferable to broad product progress built on unstable bootstrap behavior.

## Milestone Breakdown

| Milestone | Purpose                                                                            | Depends On                | Target Date |
| --------- | ---------------------------------------------------------------------------------- | ------------------------- | ----------- |
| 2.1       | Implement public auth parity for email, OTP, and passkeys                          | phase-1-native-foundation | TBD         |
| 2.2       | Recreate boot sequence, session recovery, auth headers, and redirect behavior      | 2.1                       | TBD         |
| 2.3       | Ship protected shell, onboarding, and tab-shell readiness for later product routes | 2.2                       | TBD         |

## Critical Path

Milestone 2.2 is the bottleneck. Sign-in can appear functional while session restore, expired tokens, or partial-profile recovery still fail. If bootstrap parity slips, every later phase inherits unstable route behavior.

## Sequencing Rationale

Public auth comes first because it defines the credential and session entry paths. Session bootstrap comes second because returning-user behavior is the load-bearing contract for every later route. Protected shell and onboarding come last because they depend on both successful sign-in and correct resume semantics.

## Risks

| Risk                                                                     | Likelihood | Impact | Mitigation                                                                                                         |
| ------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Passkey behavior drifts from the current Better Auth Expo flow           | Med        | High   | Validate the exact credential and challenge contract before closing 2.1                                            |
| Expired sessions and partial-profile recovery diverge from Expo behavior | High       | High   | Write explicit state tables for restore outcomes and verify them on device before closing 2.2                      |
| Protected-route redirects differ subtly from the current route guard     | Med        | High   | Trace every signed-out, onboarding, and protected-route branch against the existing route guard before closing 2.3 |

## Acceptance Criteria

This project is complete when:

- [ ] All milestones are done
- [ ] Native sign-in and session restore behaviors match the Expo app for supported auth flows
- [ ] Onboarding and protected-shell transitions are proven on device
- [ ] Later phases can host migrated routes without auth-specific workarounds

## Open Questions

- What exact secure-storage model should represent the current cookie and boot-session semantics in native? Owner: mobile team. Deadline: before 2.2 starts.
- Are any passkey edge cases intentionally unsupported today and therefore out of scope for parity? Owner: backend and mobile team. Deadline: before 2.1 exits.
- What is the canonical source for profile-completion and onboarding state during bootstrap? Owner: mobile team. Deadline: before 2.2 exits.
