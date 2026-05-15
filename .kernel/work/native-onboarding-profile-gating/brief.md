# Work Brief

## Goal

Native onboarding and profile gating parity

## Context

This work turns restore and auth facts into first-run and profile-completion behavior. It decides whether a user belongs in onboarding or the main protected shell.

## Scope

### In scope

- Onboarding flow structure and profile-completion gating
- First-run redirects after sign-in or launch restore
- Native representation of current onboarding branch rules

### Out of scope

- Protected tab shell implementation
- Inbox, notes, and settings product delivery

## Success Criteria

The work is complete when all of the following are true:

- [ ] New and incomplete profiles enter onboarding at the same points as in Expo
- [ ] Completed profiles bypass onboarding correctly
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep onboarding decisions tied to the bootstrap contract from Milestone 2.2
- Preserve first-run semantics before polishing UI details

## Dependencies

- `native-boot-sequence-and-redirect-parity`
- Current onboarding and profile-completion contract

## Related Work

- Parent: `.kernel/milestones/2-3-protected-shell-readiness/`
- Blocks: `protected-shell-tab-navigation-and-app-lock`
- Blocked by: `native-boot-sequence-and-redirect-parity`
