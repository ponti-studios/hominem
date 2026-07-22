# Navigation and UI Contract: Omiro Workspace

## Route contract

The user-visible protected root remains the Workspace/inbox route. Static routes are exported as constants, and parameterized routes remain builders. None may introduce a root Tasks destination.

| Route or builder | Contract |
| --- | --- |
| `INBOX_ROUTE` | Workspace root |
| `getWorkspaceRoute()` | Alias for Workspace root |
| `SETTINGS_ROUTE` | Pushes Settings from Workspace |
| `ARCHIVED_CHATS_ROUTE` | Pushes archived chats from Settings |
| `getContentRoute(kind, id, params?)` | Pushes chat/note detail from Workspace |
| `getTaskDetailRoute(id)` | Opens task detail from the Tasks context without changing the root model |
| `getOnboardingRoute()` | Existing protected onboarding flow |

Do not add `getTasksRoute()` as a root destination. If a task detail route requires a new hierarchy, mark it `OPEN — USER DECISION REQUIRED` first.

## Header contract

`WorkspaceHeader.ios.tsx` receives controlled state and emits intents. It does not fetch data or make route decisions.

| Prop/callback | Contract |
| --- | --- |
| `activeContext` | `chats`, `notes`, or `tasks` |
| `searchQuery` | Current-context query |
| `onContextChange(context)` | Local Workspace context change; no navigation |
| `onSearchChange(query)` | Updates current-context filtering |
| `onSearchCancel()` | Clears query and closes search |
| `onOpenSettings()` | Requests Settings push from the parent |

Required IDs:

- `workspace-context-chats`
- `workspace-context-notes`
- `workspace-context-tasks`
- `workspace-search-button`
- `workspace-search-input`
- `workspace-search-cancel`
- `workspace-open-settings`

## Presentation contract

| Surface | Required behavior |
| --- | --- |
| Chats / Notes / Tasks | Native segmented context control inside Workspace |
| Search | Native focused field replacing idle header |
| Settings | Native pushed screen |
| Detail | Native stack title/back/toolbar where already supported |
| Destructive action | Native confirmation with destructive role |

No glass effect may be the only source of a label, hit target, or state.

