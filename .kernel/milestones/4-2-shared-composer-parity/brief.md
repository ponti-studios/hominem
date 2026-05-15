# Milestone Brief

## Goal

4.2 — Shared composer parity: deliver the native shared composer, route targeting, note mentions, draft restore, and submit action behavior matching the current app.

## Target Date

TBD

## Context

This milestone is the highest-coupling part of the migration. It turns the conversation surfaces and note flows into one shared input experience that persists across routes and state changes.

Before this milestone: the chat route exists, but the main input surface and draft behavior are not yet present. After this milestone: the native app can host the same cross-route composer behavior users rely on today.

## Scope

### In scope

- Shared composer host and route targeting
- Selection chips, note mentions, and submit action parity
- Draft restore and cross-route composer state
- Composer behavior across inbox, notes, and chat hosts

### Out of scope

- Upload lifecycle and attachment state parity
- Camera, voice, and other device-feature flows beyond host hooks

## Acceptance Criteria

This milestone is complete when:

- [ ] The native shared composer behaves consistently across inbox, notes, and chat
- [ ] Route targeting, note mentions, draft restore, and submit actions match the current app closely enough for parity review
- [ ] Composer state is stable enough for later attachment and device-feature work to build on
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **shared-composer-route-targeting-and-selection-chips**: implement the shared composer host, route targeting, visibility rules, and selection-chip behavior.
2. **note-mentions-draft-restore-and-submit-actions**: implement note mentions, draft restore, and primary and secondary submit action parity.

## Dependencies

- Milestone 4.1 chat route parity
- Phase 3 note and handoff behavior from the notes project

## Risks

| Risk                                                 | Impact | Mitigation                                                                   |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Composer host behavior diverges across routes        | High   | Keep one shared state model and verify each host surface against Expo        |
| Draft restore or submit actions leak hidden coupling | High   | Make state transitions explicit and test route changes and restores directly |
