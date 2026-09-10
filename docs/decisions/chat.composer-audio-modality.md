# Chat Composer Audio Response and Walkie-Talkie Modality

## Status

Accepted (2026-09-09) — approved directly by the product owner (Charles
Ponti, chat session, 2026-09-09: "resolve W-001 and record the audio
decision"), not inferred from the behavior already shipping. That instruction
is the sign-off `composer-parity.md` required before this document existed.

## Context

`composer-parity.md` (W-001) required a recorded decision on Omiro audio
response and walkie-talkie behavior before further composer work proceeds.
`chat.capabilities.md` already documents that both apps support submitting
voice or walkie-talkie turns with `responseModality: 'audio'` and auto-playing
the committed assistant audio (`use-speech-to-text.ts`, `chat-composer-panel.tsx`,
`speech-player.tsx` on Web; `useVoiceComposerInput.ts` and
`useComposerController.ts` on Omiro), and separately posed an open question:
whether attachment and voice behavior should count as chat acceptance
criteria or remain composer-level coverage only. No prior decision doc
recorded this as approved, even though the behavior is implemented and
shipping on both platforms.

## Decision

Audio-response submission (`responseModality: 'audio'`) and walkie-talkie
turn submission are approved product behavior, not an open implementation
question, per the product owner's direction above.

This is **not** shared-controller coverage: `@hominem/chat` exports
generation/client primitives only, no composer controller. Web and Omiro each
implement their own composer — `apps/web/app/lib/hooks/use-chat-composer-state.ts`
plus `chat-composer-panel.tsx` on Web; `apps/omiro/components/composer/useComposerController.ts`
plus `useVoiceComposerInput.ts` on Omiro. Each platform's audio/walkie-talkie
implementation is approved on its own terms, and each needs its own
acceptance coverage — one platform's tests do not stand in for the other's.

`composer-parity.md`'s scope follows from this: the task does not build a new
audio/walkie-talkie contract. It closes Web's remaining recoverability gaps
against the already-approved contract — attachment retry affordance, and
voice error states (permission denial, unsupported browser, transcription
failure, cleanup) surfaced through the composer's existing error UI.

## Consequences

- `chat.capabilities.md`'s open question ("Should chat attachment and voice
  behavior be treated as chat acceptance criteria, or only as shared-composer
  coverage?") is resolved: composer-level coverage, evaluated per app.
  Acceptance evidence for attachment and voice flows belongs at each
  platform's own composer/hook level (Web: `use-file-upload`,
  `use-speech-to-text`, `chat-composer-panel`; Omiro: `useComposerController`,
  `useVoiceComposerInput`) — neither platform's coverage substitutes for the
  other's.
- `composer-parity.md` W-001 is satisfied by this document; work may proceed
  to W-002–W-004 without re-litigating whether audio/walkie-talkie behavior
  is allowed to exist.
- Any *new* audio/walkie-talkie behavior beyond what's implemented today
  (e.g., new modalities, new auto-play triggers) still requires its own
  decision — this document only ratifies the existing, shipped contract.
- If Web and Omiro's composer logic is ever consolidated into a real shared
  `@hominem/chat` controller, this document's ownership description becomes
  stale and should be updated alongside that change.
