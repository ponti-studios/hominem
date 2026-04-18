# Work Brief

## Goal

Notifications, analytics, and startup metrics parity

## Context

This work closes the operational side of device parity. It delivers the rollout-facing signals and lifecycle behaviors that Phase 6 will rely on and can progress in parallel with the device-control work once settings and observability foundations are stable.

## Scope

### In scope

- Notification behavior
- Analytics parity for lifecycle and operational signals
- Startup metrics needed for rollout validation

### Out of scope

- App lock and screenshot-prevention runtime behavior
- Widget and app-intent integration

## Success Criteria

The work is complete when all of the following are true:

- [ ] Notification and lifecycle analytics behavior match the current app closely enough for parity review
- [ ] Startup metrics are stable enough to support later rollout gates
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Preserve the operational meaning of analytics and metrics unless explicitly changed
- Verify per-variant behavior so rollout comparisons remain valid

## Dependencies

- `1-2-routing-shell-deep-links-and-observability`
- `3-3-settings-parity`
- Existing Expo lifecycle analytics and startup metric baselines

## Related Work

- Parent: `.kernel/milestones/5-2-device-control-and-telemetry-parity/`
- Blocks: `rollout-gates-dashboards-and-rollback-runbooks`
- Blocked by: `1-2-routing-shell-deep-links-and-observability`, `3-3-settings-parity`
