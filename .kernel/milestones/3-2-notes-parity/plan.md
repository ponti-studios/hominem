# Milestone Plan

## Goal

3.2 — Notes parity

## Approach

Ship notes browse and detail behavior first, then layer editor-specific autosave and handoff behavior on top. This keeps the milestone grounded in route and data parity before taking on the more fragile editor semantics.

## Work Item Breakdown

| Work Item                                    | Purpose                                                                | Depends On                          |
| -------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| native-notes-list-detail-and-search          | Notes list, detail route behavior, open flows, and search dependencies | none                                |
| note-editor-autosave-detach-and-chat-handoff | Editor state, autosave, detach behavior, and note-to-chat handoff      | native-notes-list-detail-and-search |

## Critical Path

`native-notes-list-detail-and-search` is the bottleneck because the editor work depends on stable route, note selection, and detail-state behavior.

## Sequencing Rationale

The list and detail routes come first because they define how notes are found and opened. Autosave, detach, and handoff behavior follow after the note surface is stable enough to edit reliably.

## Deliverables

- Native notes browse and detail routes
- Search and create-open behavior for note flows
- Autosave, detach, and note-to-chat parity inside the editor

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Notes browse, detail, and edit behavior are verified against Expo on device
- [ ] Note-to-chat handoff is stable enough for later conversation work

## Risks

| Risk                                                             | Likelihood | Impact | Mitigation                                                                               |
| ---------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------- |
| Editor autosave behavior is harder to reproduce than list parity | Med        | High   | Treat save triggers as explicit acceptance criteria and verify them on device            |
| Note-to-chat handoff leaks assumptions from later chat work      | Med        | Med    | Limit the handoff to current route and state behavior without prebuilding composer logic |

## Open Questions

- Which exact autosave triggers are mandatory for parity sign-off? Owner: mobile team. Deadline: before editor work exits.
- What note-search behaviors are required now versus acceptable to defer if not user-visible? Owner: mobile team. Deadline: before milestone review.
