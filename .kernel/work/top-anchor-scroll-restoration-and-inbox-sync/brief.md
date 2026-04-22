# Work Brief

## Goal

Top-anchor restoration and inbox sync parity

## Context

This work delivers the highest-risk native behavior in the inbox surface: keeping the user's context stable while the feed updates around it.

## Scope

### In scope

- Top-anchor restoration
- Scroll-context preservation across updates and refresh
- Inbox state synchronization while retaining user context

### Out of scope

- Core inbox route rendering
- Notes and chat scroll behavior

## Success Criteria

The work is complete when all of the following are true:

- [ ] Scroll context and top-anchor behavior match the current app closely enough for parity review
- [ ] Feed updates do not unexpectedly displace the user during normal inbox use
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Verify on real devices instead of relying on simulator-only behavior
- Keep the anchor model explicit so later feed surfaces can reuse or adapt it

## Dependencies

- `native-inbox-feed-refresh-parity`
- Stable inbox feed update behavior

## Related Work

- Parent: `.kernel/milestones/3-1-inbox-parity/`
- Blocks: `3-1-inbox-parity`
- Blocked by: `native-inbox-feed-refresh-parity`
