# Chat Composer Audio Response and Walkie-Talkie Modality

## Status

Accepted (2026-09-09)

## Context

`composer-parity.md` (W-001) required a recorded decision on Omiro audio
response and walkie-talkie behavior before further composer work proceeds.
`chat.capabilities.md` already documents that the shared composer supports
submitting voice or walkie-talkie turns with `responseModality: 'audio'` and
auto-playing the committed assistant audio (`use-speech-to-text.ts`,
`chat-composer-panel.tsx`, `speech-player.tsx`), and separately posed an open
question: whether attachment and voice behavior should count as chat
acceptance criteria or remain shared-composer coverage only. No prior decision
doc recorded this as approved, even though the behavior is implemented and
shipping on both Web and Omiro through the shared composer.

## Decision

Audio-response submission (`responseModality: 'audio'`) and walkie-talkie
turn submission are approved product behavior, not an open implementation
question. They are treated as **shared-composer coverage**: owned once by
`@hominem/chat`'s composer controller and consumed by both Omiro and Web,
rather than duplicated as separate per-app acceptance criteria.

`composer-parity.md`'s scope follows from this: the task does not build a new
audio/walkie-talkie contract. It closes Web's remaining recoverability gaps
against the already-approved contract — attachment retry affordance, and
voice error states (permission denial, unsupported browser, transcription
failure, cleanup) surfaced through the composer's existing error UI.

## Consequences

- `chat.capabilities.md`'s open question ("Should chat attachment and voice
  behavior be treated as chat acceptance criteria, or only as shared-composer
  coverage?") is resolved: shared-composer coverage. Acceptance evidence for
  attachment and voice flows should be added at the composer/hook level
  (`use-file-upload`, `use-speech-to-text`, `chat-composer-panel`), not
  duplicated as separate Omiro and Web acceptance suites.
- `composer-parity.md` W-001 is satisfied by this document; work may proceed
  to W-002–W-004 without re-litigating whether audio/walkie-talkie behavior
  is allowed to exist.
- Any *new* audio/walkie-talkie behavior beyond what's implemented today
  (e.g., new modalities, new auto-play triggers) still requires its own
  decision — this document only ratifies the existing, shipped contract.
