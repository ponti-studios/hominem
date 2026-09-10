# Web Composer Attachment and Voice Error Recovery

## Status

Accepted (2026-09-09)

## Context

`composer-parity.md` closed Web's remaining attachment-retry, voice-error, and
busy-state-dedup gaps against the contract approved in
[chat.composer-audio-modality.md](chat.composer-audio-modality.md). The
implementation choices below are not obvious from the code alone and would
otherwise be re-litigated the next time someone touches the composer.

## Decision

**Attachment retry resubmits by identity, not by re-selection.** `use-file-upload.ts`
keeps the `File` objects that failed (matched back to the original upload
batch by name), so `retryFailedUpload()` in `use-chat-composer-state.ts` can
resubmit exactly those files without the user re-picking them. A whole-batch
throw (network/offline) marks every file in that batch as retryable; a
partial `result.failed` list marks only the matched subset.

**Voice errors have three categories and no dedicated Retry button.**
`use-speech-to-text.ts` maps the Web Speech API's `onerror` code to
`'permission-denied' | 'microphone-unavailable' | 'transcription-failed'`.
`no-speech` and `aborted` are deliberately not treated as errors — they fire
on ordinary silence or a manual stop, not failure. Recovery is "press the mic
again": `start()` clears any prior error itself, matching Omiro's voice
composer, which also has no dedicated retry action for voice and instead
treats a new listen attempt as the retry. Do not add a Retry button to the
voice error banner — that would diverge from the cross-platform pattern
without a product reason to.

**Web's voice flow has no "cleanup" step, by design, not by omission.**
Omiro's voice composer has a background LLM polish pass over the transcript
(`use-voice-cleanup.ts`) and a recording file to discard on cancel. Web's
browser Speech API produces neither a recording file nor an intermediate
draft needing a cleanup pass — text streams directly into the composer
draft. `composer-parity.md`'s W-003 "cleanup failure" sub-item does not apply
to Web for this structural reason; it is not a gap to close later.

**Busy-state dedup uses a synchronous ref, not just React state, for voice.**
Two rapid triggers of `start()` in the same tick both read `isListening`
before React commits the first update, so `use-speech-to-text.ts` guards
re-entrancy with a plain `isListeningRef` updated synchronously inside
`start`/`stop`/`onerror`/`onend`, not through `setState`. A second `start()`
call while the ref is already `true` is a no-op — this is what prevents a
double-click from leaking a second `SpeechRecognition` instance and
duplicating transcripts. Attachment dedup is simpler and uses ordinary state:
`attachFiles` in `use-chat-composer-state.ts` no-ops if
`uploadState.isUploading` is already true, since a second concurrent call
would race the first on the shared Uppy instance rather than queue behind it.

## Consequences

- `chat.capabilities.md`'s Web parity rows for "File attachments" and "Voice
  input" reflect this: attachment retry and voice error recoverability are no
  longer open gaps, and the Verification gap section no longer lists them as
  unverified.
- Any future voice error category (e.g. a new `SpeechRecognitionErrorEvent`
  code) should extend `mapRecognitionErrorCode` in `use-speech-to-text.ts`
  rather than introducing a parallel error-handling path.
- `docs/tasks/composer-parity.md` is closed and removed; this document and
  [chat.composer-audio-modality.md](chat.composer-audio-modality.md) are the
  durable record of what it decided and built.
