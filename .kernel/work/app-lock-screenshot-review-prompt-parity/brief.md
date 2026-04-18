# Work Brief

## Goal

App lock, screenshot prevention, and review prompt parity

## Context

This work turns settings-controlled preferences into real device behavior. It delivers the user-visible control lane of Milestone 5.2 and shares settings and lifecycle foundations with the telemetry work without needing to block it.

## Scope

### In scope

- App lock behavior
- Screenshot-prevention behavior
- Review-prompt behavior

### Out of scope

- Notification delivery and lifecycle analytics
- App intents and widget integration

## Success Criteria

The work is complete when all of the following are true:

- [ ] App lock and screenshot prevention behave as configured from settings
- [ ] Review prompt behavior matches the current app closely enough for parity review
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Validate from the settings toggle through runtime behavior end to end
- Keep deeper rollout telemetry concerns out of scope

## Dependencies

- Phase 3 settings-surface parity
- Current device-control behavior from Expo

## Related Work

- Parent: `.kernel/milestones/5-2-device-control-and-telemetry-parity/`
- Blocks: `5-2-device-control-and-telemetry-parity`
- Blocked by: `3-3-settings-parity`
