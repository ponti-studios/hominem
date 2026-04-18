# Work Brief

## Goal

Native email and OTP auth parity

## Context

This work recreates the default signed-out auth path used by the current app. It defines the public auth UI and state transitions that all later auth work depends on.

## Scope

### In scope

- Email sign-in entry and OTP verification flow
- Auth-screen branching and signed-out loading or error states
- Retry, failure, and success parity for the public email path

### Out of scope

- Passkey credential flows
- Returning-session restore and protected-shell routing

## Success Criteria

The work is complete when all of the following are true:

- [ ] Users can begin email auth and complete OTP verification with parity-grade behavior
- [ ] Public auth branching, retry, and failure states match the Expo app
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Preserve the existing auth-screen-state contract unless explicitly changed
- Keep signed-out flows separate from later session-restore logic

## Dependencies

- Phase 1 root shell and routing foundation
- Stable email and OTP backend contract

## Related Work

- Parent: `.kernel/milestones/2-1-public-auth-parity/`
- Blocks: `native-passkey-sign-in-parity`
- Blocked by: `1-2-routing-shell-deep-links-and-observability`
