# Data and UI State Model: Omiro Workspace Navigation

## Workspace context

```ts
type WorkspaceContext = 'chats' | 'notes' | 'tasks';
```

This is local UI state owned by the Workspace screen. Changing it does not create a route transition or a new root destination.

## Search state

```ts
type WorkspaceSearchState = {
  isOpen: boolean;
  query: string;
  context: WorkspaceContext;
};
```

Search results are derived from the active context. Cancel clears `query`, closes the transient state, and restores the previous context.

## Existing lifecycle state

Keep the existing launch/resume and inbox draft contracts. A resume target identifies content; it does not encode a new tab stack or root destination.

## Persistence

No new persistent navigation data is approved.

## Open decision

`OPEN — USER DECISION REQUIRED`: whether the selected Workspace context should survive process termination. Do not persist it until approved.

