## Why

Mobile chat currently surfaces `Transform to task` and `Transform to task list`, but those actions are not backed by a real creation flow. The result is a menu that advertises capabilities the app cannot complete, which is confusing for users and brittle for implementation.

## What Changes

- Add a real mobile chat transform flow for `task` and `task_list` artifact types.
- Keep the existing review step, but make accept/save persist the selected artifact type instead of hardcoding note creation.
- Redesign the mobile conversation actions interface so it matches the product design system and gives us tighter control over tap targets, spacing, and state transitions.
- Update mobile chat UI to only show transform options that are supported by the current artifact pipeline.
- Thread task and task-list creation through the same lifecycle, cache, and header/source update behavior already used for notes.
- Preserve note creation behavior while expanding the review flow to support additional artifact types.

## Capabilities

### New Capabilities
- `mobile-task-creation`: mobile chat can transform a conversation into a task review and save a task artifact.
- `mobile-task-list-creation`: mobile chat can transform a conversation into a task list review and save a task list artifact.

### Modified Capabilities
- 

## Impact

- Mobile chat lifecycle and review flow in `packages/platform/ui/src/components/chat`.
- Mobile conversation actions interface and interaction model.
- Shared chat artifact/lifecycle domain types in `packages/domains/chat`.
- Mobile RPC client and any backend endpoints needed to persist task and task list artifacts.
- Mobile header/source resolution and inbox/session cache updates after save.
- Tests for classification review actions, artifact creation, and action-sheet visibility.
