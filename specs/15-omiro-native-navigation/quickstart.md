# Validation Quickstart: Omiro Workspace Navigation

## Prerequisites

- Boot the iPhone 17 Pro simulator.
- Ensure Java 17 is on `PATH` for Maestro.
- Build/install the iOS development app after native UI changes.

## Manual scenarios

1. Launch signed in. Confirm there is one Workspace surface and no bottom tab bar.
2. Select `workspace-context-chats`, `workspace-context-notes`, and `workspace-context-tasks`; confirm content changes without route transition.
3. From each context, tap `workspace-search-button`, enter a query, verify context-scoped results, then tap `workspace-search-cancel`.
4. Tap `workspace-open-settings`, verify native Settings title/back behavior, then return to Workspace.
5. Open chat, note, and task details; verify native back behavior returns to the prior context.
6. Verify stored resume targets reopen inside Workspace and do not create a new root destination.
7. Verify VoiceOver, Dynamic Type, Reduce Transparency, and safe-area behavior.

## Maestro rules

Use IDs only for app-owned controls. Do not use fuzzy text selectors in sheets or modal-like surfaces. Native system controls may expose accessibility text rather than a React Native `testID`; if a required app-owned control cannot receive a stable ID, stop and report the limitation rather than changing the product structure.

## Required automated flows

- Workspace context switch: Chats, Notes, Tasks
- Workspace search in all three contexts
- Settings push/pop
- Chat/note/task detail return
- Auth/resume restoration

