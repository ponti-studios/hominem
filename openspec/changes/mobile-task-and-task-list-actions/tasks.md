## 1. Actions surface redesign

- [ ] 1.1 Define the shared mobile actions surface primitives for title, grouped actions, destructive emphasis, and dismissal handling.
- [ ] 1.2 Replace the current header conversation menu with the shared actions surface and preserve search, archive, and transform entry points.
- [ ] 1.3 Restyle the transform affordances so they use the same spacing, states, and tap targets as the shared actions surface.

## 2. Shared artifact plumbing

- [ ] 2.1 Extend the chat artifact domain so task and task-list proposals preserve their selected `ArtifactType` through review and save.
- [ ] 2.2 Add a shared RPC/domain save contract for mobile task artifacts and wire it to the backend persistence boundary.
- [ ] 2.3 Update source/header resolution helpers so saved task and task-list artifacts resolve the active chat to the canonical source.

## 3. Mobile chat controller and review flow

- [ ] 3.1 Teach the mobile chat controller to build distinct task and task-list review payloads from the current conversation transcript.
- [ ] 3.2 Update the classification review flow so accept/save calls the shared artifact persistence path with the selected type.
- [ ] 3.3 Hide unsupported transform actions from the conversation menu by deriving menu items from enabled artifact capabilities.
- [ ] 3.4 Preserve note behavior while making task and task-list reviews available in the same lifecycle.

## 4. Cache, title, and UI sync

- [ ] 4.1 Optimistically update the active chat cache and any inbox/session caches after task or task-list save succeeds.
- [ ] 4.2 Keep the review visible and preserve the current source when task or task-list persistence fails.
- [ ] 4.3 Ensure the chat header and source labels refresh to the saved task or task-list artifact without a full refetch.

## 5. Verification

- [ ] 5.1 Add unit tests for supported transform visibility, review creation, and save behavior for task and task-list flows.
- [ ] 5.2 Add RPC/domain tests for the shared artifact save contract and returned source shape.
- [ ] 5.3 Add interaction tests for the redesigned actions surface, including destructive styling and dismissal behavior.
- [ ] 5.4 Run the relevant typecheck and test suites for the touched packages.
