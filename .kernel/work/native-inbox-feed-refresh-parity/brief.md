# Work Brief

## Goal

Native inbox feed and refresh parity

## Context

This work delivers the main inbox route and validates the first daily-use data flow in the native app. It is the baseline browse surface for later product work.

## Scope

### In scope

- Inbox route and feed rendering
- Refresh behavior and feed invalidation
- Data behavior required for stable inbox updates

### Out of scope

- Top-anchor restoration details
- Notes, settings, and chat surfaces

## Success Criteria

The work is complete when all of the following are true:

- [ ] The native inbox route renders and refreshes with parity-grade behavior
- [ ] Feed update behavior is stable enough for daily-use review
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep the inbox route aligned with the current feed contract and navigation affordances
- Separate feed correctness from later scroll-restoration tuning

## Dependencies

- Phase 2 protected shell
- Native data-client foundation from Phase 1

## Related Work

- Parent: `.kernel/milestones/3-1-inbox-parity/`
- Blocks: `top-anchor-scroll-restoration-and-inbox-sync`
- Blocked by: `2-3-protected-shell-readiness`
