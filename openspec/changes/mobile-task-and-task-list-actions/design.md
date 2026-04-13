## Context

Mobile chat currently exposes transform actions for `task`, `task_list`, and `tracker`, but the mobile lifecycle only has a real save path for notes. The current implementation routes every transform through `buildNoteProposal(...)`, which makes task and task-list actions look supported even though they do not produce distinct persisted artifacts.

The change spans shared chat-domain code, the mobile chat controller, the review UI, and the RPC layer used to persist the resulting artifact. That makes this an architectural change rather than a local UI tweak.

## Goals / Non-Goals

**Goals:**

- Support real mobile task and task-list transformation flows.
- Preserve the existing review step so the user can inspect and edit before save.
- Persist the selected artifact type all the way through save, header resolution, and cache updates.
- Hide unsupported transform actions instead of showing dead menu items.
- Keep note creation behavior intact.

**Non-Goals:**

- Reworking the desktop chat artifact pipeline.
- Adding tracker creation support.
- Changing the user-facing review model beyond what is needed for task and task-list parity.
- Redesigning the underlying task data model unless the persistence contract requires it.

## Decisions

### Model task and task-list as first-class artifact types in the review pipeline

The review flow should carry the selected `ArtifactType` end to end instead of collapsing everything into a note proposal. This keeps the mobile controller simple and preserves type-specific behavior where it matters most: building the preview, choosing the persistence method, and resolving the saved source after accept.

Alternatives considered:
- Reuse a note-only proposal shape and branch at save time. Rejected because it would keep the UI and lifecycle semantically wrong and would make task/task-list previews harder to reason about.
- Split task and task-list into separate review components. Rejected because the current review UX is already shared and the artifact differences are small enough to represent as data.

### Gate transform actions from feature capability, not from menu labels

The action sheet should render only artifact types that the current pipeline can actually save. That means the menu should derive from enabled artifact capabilities rather than listing every possible transform string and hoping the controller can handle it.

Alternatives considered:
- Leave the menu unchanged and rely on disabled save paths. Rejected because it preserves a misleading UX.

### Add a shared persistence contract in the RPC layer for task artifacts

The mobile client should call a dedicated artifact save method that accepts the artifact type and the normalized review payload. The backend route can remain the canonical persistence boundary, but the client contract should reflect the user action rather than the current note-only implementation.

Alternatives considered:
- Overload the note save API with optional task fields. Rejected because it hides the domain distinction and couples note behavior to task behavior.
- Add separate save methods for task and task list. Rejected because the flows are structurally the same and should share request validation and optimistic update handling.

### Resolve chat source and cached title from the saved artifact

After save, the active chat should update its source and header from the canonical saved artifact returned by the server. This keeps the current chat UI in sync without waiting for a full refetch.

Alternatives considered:
- Force a full refresh after every save. Rejected because it adds latency and unnecessary network churn.

## Risks / Trade-offs

- [Backend contract uncertainty] The task and task-list save route may need a new or expanded payload shape. → Keep the mobile client contract narrow and let the backend adapt behind the shared RPC method.
- [Feature gating drift] Menu visibility and lifecycle capability flags can diverge if they are maintained separately. → Derive both from the same enabled artifact-type list.
- [Shared UI complexity] One review component handling multiple artifact types can become harder to follow. → Keep type-specific branching limited to formatting and save plumbing.
- [Cache inconsistency] Optimistic updates could briefly show the wrong source or title. → Update active chat and session caches from the save response and fall back to invalidation if the response is incomplete.

## Migration Plan

1. Add the shared artifact save contract to the RPC/domain layer.
2. Update the mobile chat controller to build task and task-list proposals from the conversation transcript.
3. Update the review UI and capability gating so only supported transforms are shown.
4. Thread the selected artifact type through accept/reject, cache updates, and header resolution.
5. Add tests for the supported menu actions, review persistence, and cache/title behavior.

Rollback is straightforward: remove task/task-list capability flags from the enabled artifact list and keep the note flow intact while the backend contract is reverted or disabled.

## Open Questions

- Should task and task-list persistence use one shared endpoint or two distinct backend routes behind the same client abstraction?
- What canonical source shape should be returned for a newly created task-list artifact?
- Should the review preview expose any task-specific fields beyond the current title/body summary?
