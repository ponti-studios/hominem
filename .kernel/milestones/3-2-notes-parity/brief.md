# Milestone Brief

## Goal

3.2 — Notes parity: deliver native notes list, note detail, edit, autosave, and note-to-chat handoff behavior matching the current app.

## Target Date

TBD

## Context

This milestone extends the validated data layer into editable content. It introduces list and detail behavior, editor state, autosave semantics, and handoff into later conversation work.

Before this milestone: the native data layer is proven mainly through inbox browse behavior. After this milestone: notes can be browsed, edited, saved, and navigated in ways that later chat and composer work can rely on.

## Scope

### In scope

- Native notes list and note detail route parity
- Notes search dependencies and create or open flows
- Note editor behavior, autosave semantics, and file detachment handling
- Note-to-chat navigation handoff

### Out of scope

- Settings, archived-session, and account-management surfaces
- Global composer, streaming chat, and upload lifecycle parity

## Acceptance Criteria

This milestone is complete when:

- [ ] The native notes list and note detail behave like Expo for browse, open, and navigation cases
- [ ] Note edit, autosave, and detach behavior match the current app closely enough for parity review
- [ ] Note-to-chat handoff works correctly for later conversation flows
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-notes-list-detail-and-search**: implement notes list, note detail, create and open behavior, and search dependencies.
2. **note-editor-autosave-detach-and-chat-handoff**: implement note editor state, autosave, file detachment, and note-to-chat handoff behavior.

## Dependencies

- Milestone 3.1 inbox parity and its data-layer outcomes
- Stable note-service and note-editor contract from the current app

## Risks

| Risk                                                                                   | Impact | Mitigation                                                                           |
| -------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Notes list and detail parity drift because search and open behavior are underspecified | High   | Validate list, detail, and search transitions explicitly during milestone review     |
| Autosave semantics are simplified and lose parity                                      | High   | Preserve explicit save triggers and verify background and navigation cases on device |
