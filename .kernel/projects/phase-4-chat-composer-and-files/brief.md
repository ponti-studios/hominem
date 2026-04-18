# Project Brief

## Goal

Phase 4 — Chat, Composer, and Files

## Target Date

No date

## Context

Phase 4 ports the most coupled product loop in the app: conversations, the shared composer, mention targeting, drafts, uploads, and attachment state transitions. It is the highest-complexity phase in the migration because it combines UI, data, local persistence, and cross-route behavior.

Current state: chat, composer, and file-upload behavior are all implemented in Expo and rely on a shared global composer instance, route-aware interaction rules, optimistic updates, and local persistence in MMKV and SQLite.

When Phase 4 is done: a user can complete the current daily conversation workflow entirely in the native app, including cross-route composer behavior, draft recovery, uploads, and note-linked conversation flows.

Completing Phase 4 unlocks: production-relevant native usage across the main conversation surface and provides the host environment required by the media and Apple-integration work in Phase 5.

## Scope

### In scope

- Native chat route, message rendering, search, action menus, archive behavior, and review overlay behavior
- Native recreation of chat controller logic, session-state behavior, optimistic updates, streaming assumptions, and title updates
- Native shared composer, route targeting, note mentions, dynamic height, clearance publishing, and primary and secondary submit actions
- Draft persistence, upload lifecycle, attachment state, failure recovery, and local storage parity

### Out of scope

- Camera, voice, TTS, app intents, widget, and other Apple-specific features beyond host placeholders
- Rollout validation, production cutover, and Expo retirement

## Success Criteria

This project is complete when:

- [ ] A user can complete the current daily conversation workflow entirely in the native app
- [ ] The composer works across inbox, notes, and chat with matching visibility and action rules
- [ ] Mention targeting, attachments, and draft restore behavior match the Expo implementation
- [ ] Chat archive, new-chat creation, and note-linked conversation flows are proven on device
- [ ] All milestones are delivered and marked done

## Milestones

1. **4.1 — Chat route parity** (target: TBD): native chat route supports message rendering, search, action menus, archive, and review overlay behavior.
2. **4.2 — Shared composer parity** (target: TBD): native composer reproduces route-aware behavior, mentions, draft persistence, and primary and secondary actions.
3. **4.3 — File and attachment parity** (target: TBD): native file and attachment flows support capture handoff, upload progress, attachment removal, and note and chat insertion.

## Stakeholders

| Stakeholder | Role     | What They Care About                                                            |
| ----------- | -------- | ------------------------------------------------------------------------------- |
| Mobile team | DRI      | Managing the most coupled migration surface without creating hidden regressions |
| End users   | Informed | Reliable conversation behavior, drafts, and attachments                         |

## Constraints

- The shared composer must stay a single coherent surface across routes rather than splitting into route-specific implementations
- Local persistence and attachment state must remain consistent between notes and chat
- Streaming and optimistic update behavior must be observable enough to debug subtle regressions

## Dependencies

- Phase 3 inbox and notes data layers
- Phase 2 protected shell and navigation structure
- Native media and speech placeholders from Phase 1 for later Phase 5 hookups
