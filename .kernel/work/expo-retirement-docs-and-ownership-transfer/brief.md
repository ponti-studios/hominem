# Work Brief

## Goal

Expo retirement docs and ownership transfer

## Context

This work completes the migration operationally by documenting the new support model, cleaning up the old obligations, and transferring ownership away from Expo.

## Scope

### In scope

- Expo retirement documentation and cleanup
- Support ownership transfer
- Final operational closeout for the old client

### Out of scope

- Native release-path implementation already covered by the prior work item
- New feature work unrelated to retirement

## Success Criteria

The work is complete when all of the following are true:

- [ ] Expo no longer carries support or release obligations
- [ ] Ownership and documentation reflect the native app as the supported client
- [ ] The agreed post-cutover observation window completes without rollback triggers
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep the rollback window explicit until retirement is final
- Make documentation and ownership transfer part of completion, not aftercare

## Dependencies

- `native-release-automation-replaces-expo-lanes`
- `6-3-cutover-and-retirement`
- Agreement on whether Expo is deleted or archived in the repo

## Related Work

- Parent: `.kernel/milestones/6-3-cutover-and-retirement/`
- Blocks: `swift-migration`
- Blocked by: `native-release-automation-replaces-expo-lanes`
