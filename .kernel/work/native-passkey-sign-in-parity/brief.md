# Work Brief

## Goal

Native passkey sign-in parity

## Context

This work adds the second supported public auth path and must match the current Better Auth passkey experience closely enough to avoid contract drift before Phase 2 completes.

## Scope

### In scope

- Passkey sign-in initiation and completion
- Cancellation, unsupported, and credential-error behavior
- Integration into the existing native public auth shell

### Out of scope

- Session restore after sign-in
- Passkey management UI in settings

## Success Criteria

The work is complete when all of the following are true:

- [ ] Users can complete supported passkey sign-in flows on device
- [ ] Cancellation and failure paths match the current app's behavior closely enough for parity review
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep passkey behavior aligned with the backend contract and current mobile expectations
- Integrate into the same public auth shell rather than creating a separate auth path

## Dependencies

- `native-email-otp-auth-parity`
- Stable passkey contract from the backend

## Related Work

- Parent: `.kernel/milestones/2-1-public-auth-parity/`
- Blocks: `2-1-public-auth-parity`
- Blocked by: `native-email-otp-auth-parity`
