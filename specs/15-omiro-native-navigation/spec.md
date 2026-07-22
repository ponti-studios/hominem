# Feature Specification: Omiro Workspace Navigation

**Feature Branch**: `15-omiro-native-navigation`
**Status**: Corrected draft — product architecture owner approval required before implementation

**Input**: [Omiro Inbox Header and Navigation PRD](../../apps/omiro/docs/inbox-header-search-plan.md)

## Authority and decision boundary

The user owns product and architecture decisions. This specification records the approved user-visible navigation model. Technical implementation choices must preserve it. If Expo Router or Expo UI cannot express it directly, the implementer must stop and present alternatives; no alternative architecture may be selected implicitly.

## Product decisions

- Omiro has one primary Workspace surface.
- Chats, Notes, and Tasks are three peer contexts in the Workspace header.
- There is no bottom tab bar and no root `NativeTabs` navigator for these contexts.
- Switching context is local state, not route navigation.
- Settings is pushed from Workspace as a utility flow.
- Search is a transient, focused header state scoped to the selected context.
- Existing auth, resume, draft, data, and mutation contracts remain unchanged.

## User stories

### US1 — Switch Workspace context (P1)

As an Omiro user, I want to switch between Chats, Notes, and Tasks in one obvious header control so that related work remains in one Workspace.

Acceptance scenarios:

1. Given the user is in Workspace, when they select Chats, Notes, or Tasks, then the corresponding content appears without a route transition.
2. Given the user changes context, then the header remains in the same position and each segment remains comfortably tappable.
3. Given the user opens a detail screen and returns, then the prior Workspace context is restored.

### US2 — Search on demand (P1)

As an Omiro user, I want Search available without a permanent input row.

Acceptance scenarios:

1. Search opens from Chats, Notes, or Tasks with one tap.
2. The native field focuses immediately and names the active context.
3. Results are filtered only within that context.
4. Cancel clears the query and restores the prior context and idle header.

### US3 — Use Settings and details with native controls (P1)

As an Omiro user, I want Settings and detail screens to behave like iOS screens.

Acceptance scenarios:

1. Settings pushes from Workspace and returns through native back behavior.
2. Chat, note, and task detail screens use native titles, back gestures, and toolbars where appropriate.
3. Direct entry without history provides a valid recovery destination.

### US4 — Preserve lifecycle state (P2)

As an Omiro user, I want auth completion, deep links, and resume targets to reopen the correct Workspace context without inventing new root destinations.

Acceptance scenarios:

1. A stored chat or note resume target opens inside Workspace.
2. A task target opens the Tasks context inside Workspace unless the user explicitly approves another architecture.
3. Auth redirects resolve to Workspace through typed helpers.

## Invariants

- No `NativeTabs` implementation for this feature.
- No bottom tab bar.
- No root destination named Tasks.
- No route change for Chats/Notes/Tasks switching.
- No permanent search field.
- No platform fallback outside the approved Apple-only target.
- Visual glass effects never carry accessibility or interaction semantics alone.

## Explicitly open decisions

- `OPEN — USER DECISION REQUIRED`: whether detail screens need separate nested stack groups or can remain in the existing protected stack.
- `OPEN — USER DECISION REQUIRED`: whether the Tasks context reuses the existing `TasksPane` or receives a native SwiftUI list treatment.
- `OPEN — USER DECISION REQUIRED`: the exact SF Symbols and visual glass variant for the three context segments.

No task may resolve these open decisions silently.

