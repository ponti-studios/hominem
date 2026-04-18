# Work Brief

## Goal

Archived sessions, app lock, and screenshot settings parity

## Context

This work closes the settings phase by covering the archived-session route and the preference surfaces that later device-control work must preserve.

## Scope

### In scope

- Archived-session access and resume behavior
- App-lock toggle and settings-surface parity
- Screenshot-preference surface behavior in settings

### Out of scope

- Deep device-control implementation beyond settings-surface behavior
- Chat and media product surfaces

## Success Criteria

The work is complete when all of the following are true:

- [ ] Archived-session access and resume behavior work reliably on device
- [ ] App-lock and screenshot preferences are configurable with parity-grade behavior from settings
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Preserve current archived-session behavior and settings semantics
- Limit this work to settings-surface delivery rather than full device-control implementation

## Dependencies

- `settings-account-and-passkey-management`
- Current archived-session and preference behavior from Expo

## Related Work

- Parent: `.kernel/milestones/3-3-settings-parity/`
- Blocks: `5-2-device-control-and-telemetry-parity`
- Blocked by: `settings-account-and-passkey-management`
