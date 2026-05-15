# Work Brief

## Goal

Native boot sequence and redirect parity

## Context

This work recreates the launch-state machine that decides whether the app enters signed-out flow, onboarding, or the protected shell. It is the load-bearing restore behavior for the rest of the migration.

## Scope

### In scope

- Cold-launch bootstrap sequence
- Profile recovery and expired-session handling
- Redirect behavior for returning-user launch states

### Out of scope

- Protected-shell UI delivery
- Product-surface routing beyond launch decisions

## Success Criteria

The work is complete when all of the following are true:

- [ ] Launch-state transitions for returning users match the Expo app
- [ ] Expired-session and partial-profile paths redirect correctly
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep bootstrap states explicit and testable
- Preserve the current redirect contract unless a deliberate migration decision changes it

## Dependencies

- `native-session-storage-and-auth-provider`
- Current auth and profile-recovery semantics

## Related Work

- Parent: `.kernel/milestones/2-2-session-bootstrap-parity/`
- Blocks: `native-onboarding-profile-gating`, `protected-shell-tab-navigation-and-app-lock`
- Blocked by: `native-session-storage-and-auth-provider`
