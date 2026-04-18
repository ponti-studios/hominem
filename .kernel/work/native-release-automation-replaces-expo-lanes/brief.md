# Work Brief

## Goal

Native release automation replaces Expo release lanes

## Context

This work moves production release authority from Expo to the native app. It is the technical precondition for retiring Expo as a supported operational client.

## Scope

### In scope

- Native release automation and support processes
- Replacement of Expo release obligations
- Production release-path readiness for cutover

### Out of scope

- Final documentation cleanup and support ownership transfer
- Additional rollout validation already covered in the prior milestone

## Success Criteria

The work is complete when all of the following are true:

- [ ] Native release automation is the authoritative production path after cutover approval
- [ ] Expo release obligations are no longer required for current production support
- [ ] Production support ownership is explicit enough to carry the post-cutover observation window
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep rollback awareness available until Expo retirement is final
- Treat production support behavior as part of the release path, not a separate follow-up concern

## Dependencies

- `6-2-parallel-run-and-rollout-proof`
- Approval to move production support to the native client

## Related Work

- Parent: `.kernel/milestones/6-3-cutover-and-retirement/`
- Blocks: `expo-retirement-docs-and-ownership-transfer`
- Blocked by: `6-2-parallel-run-and-rollout-proof`
