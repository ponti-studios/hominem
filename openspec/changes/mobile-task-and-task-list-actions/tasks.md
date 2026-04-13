## 1. Shared artifact plumbing

- [ ] 1.1 Extend the chat artifact domain so task and task-list proposals preserve their selected `ArtifactType` through review and save.
- [ ] 1.2 Add a shared RPC/domain save contract for mobile task artifacts and wire it to the backend persistence boundary.
- [ ] 1.3 Update source/header resolution helpers so saved task and task-list artifacts resolve the active chat to the canonical source.

## 2. Mobile chat controller and review flow

- [ ] 2.1 Teach the mobile chat controller to build distinct task and task-list review payloads from the current conversation transcript.
- [ ] 2.2 Update the classification review flow so accept/save calls the shared artifact persistence path with the selected type.
- [ ] 2.3 Hide unsupported transform actions from the conversation menu by deriving menu items from enabled artifact capabilities.
- [ ] 2.4 Preserve note behavior while making task and task-list reviews available in the same lifecycle.

## 3. Cache, title, and UI sync

- [ ] 3.1 Optimistically update the active chat cache and any inbox/session caches after task or task-list save succeeds.
- [ ] 3.2 Keep the review visible and preserve the current source when task or task-list persistence fails.
- [ ] 3.3 Ensure the chat header and source labels refresh to the saved task or task-list artifact without a full refetch.

## 4. Verification

- [ ] 4.1 Add unit tests for supported transform visibility, review creation, and save behavior for task and task-list flows.
- [ ] 4.2 Add RPC/domain tests for the shared artifact save contract and returned source shape.
- [ ] 4.3 Run the relevant typecheck and test suites for the touched packages.
