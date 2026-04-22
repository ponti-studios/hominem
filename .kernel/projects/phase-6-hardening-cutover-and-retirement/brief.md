# Project Brief

## Goal

Phase 6 — Hardening, Cutover, and Retirement

## Target Date

No date

## Context

Phase 6 validates full parity, runs both apps in parallel, moves production users to native iOS, and retires the Expo app only after the new client proves stable. This phase turns the migration from engineering completion into operational completion.

Current state: the Expo app is still the production iOS client, and native rollout readiness depends on earlier phases delivering full parity plus telemetry and release confidence.

When Phase 6 is done: the native app passes agreed rollout gates, becomes the supported iOS client, and the Expo app can be retired without leaving a supported feature gap.

Completing Phase 6 unlocks: initiative completion and Expo retirement.

## Scope

### In scope

- Native regression, smoke, and rollout validation coverage for all critical migrated flows
- Rollout gates, crash and latency thresholds, analytics dashboards, and rollback procedures
- Parallel run of the Expo and native apps for internal and staged external users
- Release-lane replacement, Expo retirement steps, and operational ownership transfer

### Out of scope

- Net-new product work unrelated to parity or cutover
- Partial cutover without agreed rollout evidence

## Success Criteria

This project is complete when:

- [ ] The native app passes all agreed rollout gates
- [ ] No P0 or P1 parity regressions remain open for in-scope surfaces
- [ ] Native release automation replaces the current Expo release path
- [ ] The Expo app can be retired without leaving a supported feature gap
- [ ] All milestones are delivered and marked done

## Milestones

1. **6.1 — Test and regression parity** (target: TBD): native regression coverage protects the critical flows currently guarded by mobile tests plus new native-only high-risk flows.
2. **6.2 — Parallel run and rollout proof** (target: TBD): internal and staged external rollout proves launch, auth, inbox, notes, chat, composer, media, and intent stability.
3. **6.3 — Cutover and retirement** (target: TBD): Expo retirement plan is executed with release-lane shutdown, documentation updates, and ownership transfer.

## Stakeholders

| Stakeholder        | Role     | What They Care About                                                           |
| ------------------ | -------- | ------------------------------------------------------------------------------ |
| Mobile team        | DRI      | Safe rollout, actionable telemetry, and a reversible cutover path              |
| Product leadership | Approver | Confidence that the native app is stable enough to become the supported client |
| End users          | Informed | A stable migration with no loss of supported functionality                     |

## Constraints

- Cutover cannot happen on visual parity alone; functional, storage, analytics, and native integration parity must also pass
- Expo cannot be retired while any parity-matrix surface still depends on it for production use
- Rollback capability must remain available until post-cutover thresholds are met

## Dependencies

- Phases 1 through 5 complete
- Full parity evidence captured for each row in `apps/mobile/docs/swift-migration/parity-matrix.md`
