# Voice transcription hang: postmortem

> Historical incident. This postmortem describes the former `SFSpeechRecognitionTask` implementation. The current native implementation uses iOS `SpeechAnalyzer`; the self-retaining delegate shown below is no longer present in the codebase. Keep this document as incident history, not as current implementation guidance.

## Symptom

Recording worked fine — the mic UI showed the timer and level meter, and
stopping the recording logged a clean `[recorder] recording stopped` with a
valid `fileUri`. But after that, nothing happened: no transcript, no error,
no [voice-cleanup] log — the mic icon just spun forever. The recording file
itself was valid (confirmed non-zero file size in logs).

## Where the trail led

Logging was added at every step of the JS path
(`useVoiceComposerInput.ts`) and the native path
(`VoiceTranscriberModule.swift`, via `os_log`). The JS side confirmed
`VoiceTranscriberModule.transcribeFile(fileUri)` was called. The native side
confirmed the request got as far as:

```
transcribeFile AsyncFunction invoked
transcribeAudioFile: start uri=...
transcribeAudioFile: authStatus=authorized
transcribeAudioFile: fileExists=true fileSize=661244
transcribeAudioFile: recognizer created locale=en-US isAvailable=true supportsOnDevice=true
transcribeAudioFile: starting recognitionTask isOnDevice=true
transcribeAudioFile: recognitionTask created, awaiting delegate callbacks
```

...and then silence. Not a single `SFSpeechRecognitionTaskDelegate` callback
ever fired — not even `didHypothesizeTranscription`, which normally arrives
within milliseconds once speech is detected.

As a diagnostic, on-device recognition was forced off
(`requiresOnDeviceRecognition = false`, i.e. server-based only) to rule out
an on-device model/daemon problem. The result was identical: the task was
created, and then nothing — no callbacks, on-device or server-based. That
symmetry ruled out anything specific to Apple's on-device speech daemon
(`corespeechd`) and pointed at something more fundamental: the
`SFSpeechRecognitionTask` itself was never actually running.

## Root cause

```swift
return try await withCheckedThrowingContinuation { continuation in
  let delegate = VoiceTranscriptionTaskDelegate(
    continuation: continuation,
    locale: locale,
    isOnDevice: isOnDevice,
    recognizer: recognizer
  )
  let task = recognizer.recognitionTask(with: request, delegate: delegate)
  delegate.attachTask(task)
}
```

`delegate` was a **local variable**, scoped to this one setup closure.
`SFSpeechRecognitionTask` follows the standard Apple delegate convention and
holds its delegate **weakly** — it does not keep the delegate alive on your
behalf. The setup closure above runs synchronously once (create the
delegate, start the task, return), and then exits. At that point, nothing
in the object graph holds a *strong* reference to `delegate` anymore:

- `continuation` doesn't reference it.
- `task` doesn't retain it (weak delegate reference).
- The closure itself is discarded by `withCheckedThrowingContinuation`
  once it returns — it doesn't keep its captured locals alive after that.

So the moment `transcribeAudioFile`'s setup closure returned, ARC was free
to deallocate `delegate` immediately. With the delegate gone, there was
nothing left to receive `SFSpeechRecognitionTaskDelegate` callbacks — the
recognition task kept running invisibly, but no code was left to hear about
it finishing, failing, or producing a transcript. The `CheckedContinuation`
captured inside the (now-deallocated) delegate was never resumed, so the
`await` in `transcribeAudioFile` — and the JS `await
VoiceTranscriberModule.transcribeFile(fileUri)` — hung forever. No error,
no crash, no timeout: just a promise that never settles.

This also explains a smaller, related bug that was fixed alongside it: the
`recognizer` used to create the task was *also* a local variable with no
external strong reference, so it was independently vulnerable to the same
premature-deallocation problem. That one had already been patched by giving
the delegate a `let recognizer: SFSpeechRecognizer` property to hold it —
correct, but insufficient on its own, since it only kept the *recognizer*
alive, not the *delegate* that actually needed to survive to receive the
callbacks.

## Why earlier assumptions were wrong

Initial hypotheses (in order of suspicion) were:

1. **Simulator has no real microphone** — plausible early on, but this was
   eventually tested on a physical device and still hung.
2. **On-device Speech model not downloaded for this locale/device, and the
   `corespeechd` daemon failing to service the request** — supported by
   `Failed to config AOP VoiceTrigger` errors observed in Console.app. This
   looked like a strong lead, but the diagnostic (forcing
   `requiresOnDeviceRecognition = false`) hung in exactly the same way,
   which ruled this out as the primary cause. (It's possible the
   `corespeechd` errors were a red herring / unrelated system noise, or a
   secondary symptom — but they were not the reason `transcribeFile` never
   resolved.)
3. **Recognizer being deallocated mid-flight** — a real bug, and worth
   fixing, but fixing it alone did not resolve the hang, because the
   delegate had the same problem and was the one actually needed to
   receive callbacks.

The pattern worth remembering: when a `SFSpeechRecognitionTask` (or any
callback-based API using a delegate object created inline) simply produces
*zero* callbacks — not an error, not a partial result, nothing — object
lifetime is a much more likely culprit than the recognition backend itself.
A daemon-level failure or permission problem almost always still calls back
with an error (`didFinishSuccessfully: false` with a populated `task.error`,
or a thrown exception before the task is even created). Total silence
implies the callback target doesn't exist anymore.

## The fix

Make the delegate keep itself alive for the duration of the request, and
release itself once it's done:

```swift
private final class VoiceTranscriptionTaskDelegate: NSObject, SFSpeechRecognitionTaskDelegate {
  // ...
  private var selfRetain: VoiceTranscriptionTaskDelegate?

  init(...) {
    // ...
    super.init()
    self.selfRetain = self
  }

  private func resume(throwing error: Error) {
    guard !didResume else { return }
    didResume = true
    task?.cancel()
    continuation.resume(throwing: error)
    selfRetain = nil   // break the retain cycle once we're done
  }

  private func resume(with transcript: String) {
    guard !didResume else { return }
    didResume = true
    task?.cancel()
    // ...
    continuation.resume(...)
    selfRetain = nil   // break the retain cycle once we're done
  }
}
```

This is the standard pattern for any delegate-based async API where the
delegate is created inline and needs to outlive the scope that created it:
have the object hold a strong reference to itself (`selfRetain = self`)
after `init`, so ARC treats it as reachable regardless of what happens to
the local variable that originally pointed to it. Once the work is done
(success or failure) and there's no more need to receive callbacks, clear
that reference (`selfRetain = nil`) so the object can finally be
deallocated and doesn't leak.

With this in place, `SFSpeechRecognitionTask` had a delegate that was
guaranteed to still exist when it tried to call back — the recognition
callbacks fired as expected, the continuation resumed, and
`transcribeFile()` resolved with a real transcript instead of hanging
indefinitely.

## Files touched

- `apps/omiro/modules/voice-transcriber/ios/VoiceTranscriberModule.swift`
  — added `selfRetain` self-retain/release to
  `VoiceTranscriptionTaskDelegate`; kept the earlier `recognizer` retention
  fix (still correct, just not sufficient alone); added `os_log` tracing
  through `transcribeAudioFile` and every delegate callback.
- `apps/omiro/components/composer/useVoiceComposerInput.ts` — added
  `logger.info`/`logger.warn` tracing through `handleVoicePress`,
  `stopAndTranscribeRecording`, and `processStoppedRecording`, which is what
  made it possible to confirm the hang was strictly on the native side and
  not in the JS bridge call itself.

## Current implementation note

The native module was subsequently refactored to `SpeechAnalyzer`, which feeds
the recorded file through an `AsyncStream<AnalyzerInput>` and collects finalized
transcription results. See `apps/omiro/modules/voice-transcriber/ios/VoiceTranscriberModule.swift`
for the current path. The original delegate-lifetime diagnosis remains valid
for the implementation that produced this incident, but its concrete fix is
not a description of the current object graph.
