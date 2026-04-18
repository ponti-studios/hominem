# Work Brief

## Goal

Protected shell, tab navigation, and app lock foundation parity

## Context

This work provides the shell that later product surfaces will live inside. It must reproduce protected-route structure and host-level behavior without forcing later phases to reshape navigation.

## Scope

### In scope

- Protected shell composition and route guarding
- Tab navigation structure for inbox, notes, chat, and settings hosting
- App-lock foundations needed by later settings and device-control work

### Out of scope

- Full inbox, notes, chat, and settings product parity
- Complete screenshot-prevention and device-feature delivery

## Success Criteria

The work is complete when all of the following are true:

- [ ] The native protected shell and tab structure match Expo closely enough to host later routes
- [ ] Route guarding and protected entry behavior work on device
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Match the current shell boundaries instead of inventing a new navigation shape
- Limit app-lock work to the host hooks needed by later phases

## Dependencies

- `native-onboarding-profile-gating`
- Stable protected-route inventory from the Phase 1 placeholder shell

## Related Work

- Parent: `.kernel/milestones/2-3-protected-shell-readiness/`
- Blocks: `phase-3-inbox-notes-and-settings`
- Blocked by: `native-onboarding-profile-gating`
