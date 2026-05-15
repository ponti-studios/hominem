# Milestone Plan

## Goal

2.3 — Protected shell readiness

## Approach

Implement profile gating and onboarding first, then attach the protected tab shell and route guard to those outcomes. This keeps first-run and returning-user decisions explicit before the shell starts hosting more product routes.

## Work Item Breakdown

| Work Item                                   | Purpose                                                                | Depends On                       |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| native-onboarding-profile-gating            | Onboarding flow, profile completion checks, and first-run redirects    | none                             |
| protected-shell-tab-navigation-and-app-lock | Protected shell, tab navigation, route guard, and app-lock foundations | native-onboarding-profile-gating |

## Critical Path

`native-onboarding-profile-gating` is the bottleneck because the protected shell cannot route correctly until the app knows whether onboarding is complete.

## Sequencing Rationale

First-run gating comes first because it decides whether a signed-in user sees onboarding or the main shell. The protected tab shell follows once that decision model is stable and can host later product routes without structural churn.

## Deliverables

- Native onboarding and profile-gating behavior
- Protected shell and tab navigation structure for later routes
- App-lock foundation integrated into protected entry points

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Onboarding and protected-route entry behavior are verified on device
- [ ] The protected shell can host later phase surfaces without auth-specific workarounds

## Risks

| Risk                                                                | Likelihood | Impact | Mitigation                                                                        |
| ------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------- |
| Onboarding logic duplicates rather than extends bootstrap state     | Med        | High   | Keep gating rules anchored to the Milestone 2.2 session model                     |
| App-lock foundations are either under-scoped or overbuilt too early | Med        | Med    | Limit this milestone to the host hooks needed by later settings and device phases |

## Open Questions

- Which shell behaviors must be exact for Phase 3 hosting, and which can remain placeholder-level? Owner: mobile team. Deadline: before protected-shell work exits.
- What is the minimum app-lock wiring required now versus what belongs in Phase 5? Owner: mobile team. Deadline: before milestone sign-off.
