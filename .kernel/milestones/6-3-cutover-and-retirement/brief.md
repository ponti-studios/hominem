# Milestone Brief

## Goal

6.3 — Cutover and retirement: replace Expo release obligations with native release automation, cut over production support, and retire Expo safely.

## Target Date

TBD

## Context

This milestone is the irreversible part of the migration. It moves the supported iOS client from Expo to native and cleans up the remaining operational ownership tied to the old client.

Before this milestone: the native app has proven itself in rollout, but Expo is still part of the supported operational path. After this milestone: the native app is the supported client, the agreed observation window has passed without rollback triggers, and Expo no longer carries release or support obligations.

## Scope

### In scope

- Native release automation replacing Expo release obligations
- Cutover execution and support ownership transfer
- Expo retirement documentation and operational cleanup
- Final migration closeout steps tied to production support

### Out of scope

- Additional feature delivery unrelated to cutover
- Partial retirement that leaves Expo as a shadow supported client

## Acceptance Criteria

This milestone is complete when:

- [ ] Native release automation is the supported production path
- [ ] Expo release obligations and support ownership are retired safely
- [ ] Cutover is complete with no unsupported feature gap remaining
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-release-automation-replaces-expo-lanes**: replace Expo release obligations with native release automation and production support processes.
2. **expo-retirement-docs-and-ownership-transfer**: retire Expo operationally through documentation updates, cleanup, and ownership transfer.

## Ownership

- DRI: engineering leadership
- Cutover approval: product leadership and engineering leadership
- Retirement sign-off: engineering leadership

## Dependencies

- Milestone 6.2 rollout proof and cutover approval
- Agreement on retirement mode for Expo inside the repo and operations

## Risks

| Risk                                                         | Impact | Mitigation                                                    |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------- |
| Release automation changes before support ownership is ready | High   | Complete runbooks and ownership transfer before final cutover |
| Expo is retired while a hidden support dependency remains    | High   | Require explicit retirement checklist review before closure   |
