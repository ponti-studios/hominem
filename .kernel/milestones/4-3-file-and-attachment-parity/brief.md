# Milestone Brief

## Goal

4.3 — File and attachment parity: deliver native upload lifecycle, attachment state, and insertion or removal behavior across notes and chat.

## Target Date

TBD

## Context

This milestone closes the conversation phase by making the shared composer and conversation hosts useful for file-backed workflows. It connects uploads, local state, and insertion behavior across note and chat surfaces.

Before this milestone: the chat route and shared composer exist, but attachment state and upload lifecycle parity are not yet available. After this milestone: users can attach, upload, recover, and remove files with parity-grade behavior across supported hosts.

## Scope

### In scope

- Upload lifecycle, progress, failure, and recovery behavior
- Attachment insertion and removal in notes and chat
- Local cache and attachment-state behavior needed by cross-surface parity
- Attachment state shared across conversation and note contexts

### Out of scope

- Camera and voice capture flows beyond file-host readiness
- Widget, app-intent, and other Apple-specific surfaces

## Acceptance Criteria

This milestone is complete when:

- [ ] Upload lifecycle, failure, and recovery behavior match the current app closely enough for parity review
- [ ] Attachment insertion and removal work consistently in notes and chat
- [ ] Local cache and attachment state are stable enough for Phase 5 media flows to build on
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-upload-lifecycle-and-failure-recovery**: implement upload progress, failure handling, retry, and recovery behavior.
2. **attachment-state-across-notes-chat-and-local-cache**: implement insertion, removal, and local attachment-state parity across notes and chat.

## Dependencies

- Milestone 4.2 shared composer parity
- Stable local storage foundations from earlier phases

## Risks

| Risk                                                     | Impact | Mitigation                                                                     |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Upload and retry behavior diverge under error conditions | High   | Verify failure, retry, and recovery explicitly rather than only the happy path |
| Attachment state drifts between notes and chat           | High   | Keep one shared state model where possible and review both hosts together      |
