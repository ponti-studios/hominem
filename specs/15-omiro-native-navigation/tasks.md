# Tasks: Omiro Workspace Navigation

**Authority**: The user owns product and architecture decisions. These tasks may not introduce a bottom tab bar, `NativeTabs`, or a separate Tasks root destination.

## Phase 1 — Reconcile and gate

- [ ] T001 Read the corrected PRD, specification, contract, research, and current route tree before editing.
- [ ] T002 Inventory current implementation changes that contradict the approved model, including `(tabs)`, `NativeTabs`, separate Tasks routes, and two-context header state.
- [ ] T003 Confirm unresolved architecture choices with the user before creating route migrations.

## Phase 2 — Restore the approved Workspace model

- [ ] T004 Restore one protected Workspace root and remove the incorrect NativeTabs shell.
- [ ] T005 Restore `WorkspaceContext = 'chats' | 'notes' | 'tasks'` in the screen state.
- [ ] T006 Restore TasksPane ownership inside Workspace without changing task data/mutation services.
- [ ] T007 Remove or quarantine route helpers and files that introduce a separate Tasks root destination.
- [ ] T008 Update route tests to assert one Workspace root and no root Tasks route.

## Phase 3 — Implement the approved native header

- [ ] T009 Implement the iOS-only native header with a three-option labeled Picker.
- [ ] T010 Ensure Chats, Notes, and Tasks each have stable IDs and native-sized hit targets.
- [ ] T011 Keep Settings and Search actions in the same header composition.
- [ ] T012 Implement focused native search and active-context-scoped filtering.
- [ ] T013 Update Maestro flows for all three contexts, Search, Cancel, and Settings by ID.

## Phase 4 — Preserve approved navigation behavior

- [ ] T014 Verify Settings remains a pushed utility flow from Workspace.
- [ ] T015 Verify chat, note, and task detail return paths without changing root/context ownership.
- [ ] T016 Audit direct protected-route strings and compatibility aliases without inventing new destinations.
- [ ] T017 Verify auth and resume restoration enter Workspace and preserve content identity.

## Phase 5 — Validation

- [ ] T018 Run typecheck, lint, unit tests, and iOS bundle export.
- [ ] T019 Run Maestro context/search/settings/detail flows on the simulator.
- [ ] T020 Perform manual accessibility and safe-area verification.
- [ ] T021 Record any technical limitation that would require an architecture decision as `OPEN — USER DECISION REQUIRED`.

## Stop conditions

Stop and ask the user if any implementation step would require:

- a bottom tab bar;
- a root Tasks destination;
- changing Chats/Notes/Tasks from local context state to route navigation;
- changing Settings ownership;
- changing persistence or lifecycle behavior beyond the approved PRD.

