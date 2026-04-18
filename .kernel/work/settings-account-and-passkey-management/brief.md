# Work Brief

## Goal

Settings account and passkey management parity

## Context

This work establishes the main settings route and its auth-linked management surfaces. It anchors settings behavior in account correctness before archived sessions and device preferences are added.

## Scope

### In scope

- Settings route and account-editing surface
- Passkey-management surface wiring
- Core settings-host behavior for later preference work

### Out of scope

- Archived-session behavior
- Full device-control implementation beyond settings wiring

## Success Criteria

The work is complete when all of the following are true:

- [ ] Account editing and passkey-management surfaces behave with parity-grade correctness
- [ ] The settings host is stable enough for later preference and archived-session work
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep account behavior aligned with the current auth model
- Scope passkey work to settings-surface parity, not platform-deep behavior that belongs later

## Dependencies

- Phase 2 auth foundations
- Current settings and passkey-management behavior from Expo

## Related Work

- Parent: `.kernel/milestones/3-3-settings-parity/`
- Blocks: `archived-sessions-app-lock-and-screenshot-settings`
- Blocked by: `2-3-protected-shell-readiness`
