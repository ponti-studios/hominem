# Implementation Plan: Omiro Workspace Navigation

## Authority

This plan implements the approved Workspace model. It must not introduce a bottom tab bar, `NativeTabs`, or a separate Tasks root destination. Any task that would require one is blocked pending user decision.

## Technical direction

- Keep the existing protected Workspace route as the user-visible root.
- Render an iOS-only screen-owned header using Expo UI SwiftUI primitives because the reference composition combines a three-way segmented control, actions, and an in-place search takeover.
- Use a native SwiftUI `Picker` with three labeled options: Chats, Notes, Tasks.
- Use native SF Symbol actions for Settings and Search with stable identifiers.
- Use a native SwiftUI `TextField` for focused search.
- Keep detail/settings navigation on the existing or an approved native Stack arrangement; do not change route ownership without approval.
- Preserve current services and state contracts.

## Non-negotiable architecture checks

Before implementation, verify:

1. No planned file adds `NativeTabs`.
2. No planned route helper creates a root Tasks destination.
3. Workspace context switching remains local state.
4. Search remains transient and context-scoped.
5. Any unresolved architecture choice is marked `OPEN — USER DECISION REQUIRED`.

## Phases

### Phase A — Reconcile the current implementation

1. Remove the incorrect root `(tabs)` architecture from the feature branch/worktree.
2. Restore one protected Workspace entry point.
3. Restore the three-way context state and TasksPane ownership inside Workspace.
4. Remove stale two-destination route helpers and tests.

### Phase B — Build the approved header

1. Implement `WorkspaceHeader.ios.tsx` with controlled `chats | notes | tasks` state.
2. Give every context a native 44-point target and stable accessibility identifier.
3. Keep Settings and Search actions in the same header row.
4. Implement focused search and active-context filtering.

### Phase C — Normalize only approved native chrome

1. Preserve existing detail/settings destinations.
2. Apply native stack titles, back behavior, and toolbars where they do not change the information architecture.
3. Leave content-local sheets and overlays alone unless the user approves a presentation change.

### Phase D — Validate

1. Run unit tests for route compatibility and context-scoped filtering.
2. Run Maestro by IDs for all three contexts, Search, Settings, and return paths.
3. Verify accessibility and safe area behavior on the booted iPhone simulator.

## Deliberately excluded

Root native tabs, bottom tab bars, a separate Tasks stack, and any route migration that makes Tasks a root destination are excluded because they contradict the approved PRD.

