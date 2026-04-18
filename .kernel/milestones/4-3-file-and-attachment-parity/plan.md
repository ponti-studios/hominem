# Milestone Plan

## Goal

4.3 — File and attachment parity

## Approach

Deliver upload lifecycle behavior first, then connect attachment state into notes and chat hosts. This separates network and recovery behavior from the cross-surface state model layered on top.

## Work Item Breakdown

| Work Item                                          | Purpose                                                                            | Depends On                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| native-upload-lifecycle-and-failure-recovery       | Upload progress, failure handling, retry, and recovery behavior                    | none                                         |
| attachment-state-across-notes-chat-and-local-cache | Shared attachment insertion, removal, and local-state parity across notes and chat | native-upload-lifecycle-and-failure-recovery |

## Critical Path

`native-upload-lifecycle-and-failure-recovery` is the bottleneck because shared attachment state is not meaningful until upload behavior itself is correct.

## Sequencing Rationale

Upload lifecycle lands first because it defines progress, retry, and error semantics. Shared attachment state follows because it depends on those outcomes remaining coherent across hosts.

## Deliverables

- Native upload lifecycle with retry and failure recovery
- Attachment insertion and removal across notes and chat
- Local-state parity for file-backed workflows

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Upload and attachment behavior are verified on device against Expo
- [ ] Attachment state is stable enough for Phase 5 media-host work

## Risks

| Risk                                                    | Likelihood | Impact | Mitigation                                                          |
| ------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------- |
| Upload error handling behaves differently across hosts  | Med        | High   | Verify retry and recovery in both note and chat flows during review |
| Local cache behavior becomes overly coupled to one host | Med        | Med    | Keep attachment state model shared and host-agnostic where possible |

## Open Questions

- Which upload-failure behaviors are required for parity sign-off versus acceptable follow-up detail? Owner: mobile team. Deadline: before upload work exits.
- What attachment-state transitions must remain identical between notes and chat? Owner: mobile team. Deadline: before milestone review.
