# Project Brief

## Goal

Phase 3 — Inbox, Notes, and Settings

## Target Date

No date

## Context

Phase 3 ports the primary non-conversation productivity surfaces so the native app can support browse, read, edit, and account-management loops before chat migration begins. This is the first phase where the native app needs to feel like a daily-driver client for core non-chat use cases.

Current state: inbox, notes, settings, archived chats, query-client behavior, and API-provider behavior all live in the Expo app. The native app needs a comparable data layer and scroll, edit, and account-management semantics before conversation work can land safely.

Current native progress: the Swift app now has inbox, notes, and settings screens in place, plus note autosave guarding, inbox top-anchor signaling, archived chats routing, and settings-level account/sign-out resets. The remaining work is to close parity gaps in the data layer and flesh out the daily-use behaviors that are still placeholder or partial.

When Phase 3 is done: inbox, notes, and settings behave consistently with the Expo client on real devices, including feed refresh and top anchoring, note edit and save semantics, archived-session access, and the core account-management surface.

Completing Phase 3 unlocks: Phase 4, because chat, composer, and attachments rely on the same data-layer and navigation assumptions established here.

## Scope

### In scope

- Native inbox route, feed components, refresh behavior, and top-anchor restoration
- Native notes list, note detail editor, autosave behavior, search dependencies, and note-to-chat transition
- Native settings route, archived chats route, account editing surface, passkey management surface wiring, app-lock toggle, and screenshot preference surface
- Native query, cache, pagination, invalidation, and optimistic state rules needed by inbox and notes

### Out of scope

- Chat route, conversation UI, composer behavior, and file-upload product flows
- Camera, voice, widget, and app-intent work
- Production rollout and cutover

## Success Criteria

This project is complete when:

- [ ] Inbox, notes, and settings can be used daily without falling back to the Expo app
- [ ] Top-anchored feed behavior is confirmed on real devices
- [ ] Note edit, save, detach, and navigation behavior matches the current app
- [ ] Account and archived-session flows behave consistently with the Expo app
- [ ] The native data layer is stable enough for chat and composer work to build on
- [ ] All milestones are delivered and marked done

## Milestones

1. **3.1 — Inbox parity** (target: TBD): native inbox route matches current feed behavior, refresh model, and top-anchor restoration.
2. **3.2 — Notes parity** (target: TBD): native notes list and note detail parity cover create, edit, scroll, attachment visibility, and note-to-chat transition.
3. **3.3 — Settings parity** (target: TBD): native settings parity covers account editing, archived chats access, app lock toggle, screenshot preference, and passkey management surface wiring.

## Stakeholders

| Stakeholder | Role     | What They Care About                                                              |
| ----------- | -------- | --------------------------------------------------------------------------------- |
| Mobile team | DRI      | Stable data-layer patterns, real-device parity, and reduced rework before Phase 4 |
| End users   | Informed | Reliable daily productivity loops for inbox, notes, and settings                  |

## Constraints

- Feed anchoring and note autosave behavior must match the current app closely enough to avoid daily-use regressions
- The native data layer must be reusable by later chat and composer work
- Settings cannot diverge from auth and device-preference semantics established earlier or later in the initiative

## Dependencies

- Phase 2 protected shell and auth context
- Native data-client foundation from Phase 1
