# Work Brief

## Goal

Native session storage and auth provider parity

## Context

This work creates the native session model that later bootstrap and protected-shell behavior rely on. It replaces Expo-side storage and provider lifecycle assumptions with a native equivalent.

## Scope

### In scope

- Secure session storage and sign-out handling
- Auth-provider lifecycle and protected request header behavior
- Native representation of the current mobile session contract

### Out of scope

- Boot-state transitions and redirect decisions
- Onboarding and protected-shell UI delivery

## Success Criteria

The work is complete when all of the following are true:

- [ ] Session persistence, sign-out behavior, and auth-header setup match the current app contract
- [ ] The native auth provider exposes the state needed by later bootstrap and protected-shell work
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Preserve backend-facing auth-header semantics
- Keep session facts explicit so later bootstrap logic can reason about them cleanly

## Dependencies

- Milestone 2.1 public auth parity
- Current auth cookie and session-storage contract

## Related Work

- Parent: `.kernel/milestones/2-2-session-bootstrap-parity/`
- Blocks: `native-boot-sequence-and-redirect-parity`
- Blocked by: `2-1-public-auth-parity`
