import ExpoModulesCore
import Foundation
import Speech

// A single Exception type carrying a stable `code` alongside its message, so
// the JS side can branch on `error.code` (e.g. to route a revoked-permission
// failure to the same UX as the initial permission gate) instead of parsing
// free-text error messages, which are not a stable contract.
private final class VoiceTranscriberException: Exception {
  private let messageText: String
  private let codeText: String

  init(code: String, message: String) {
    self.codeText = code
    self.messageText = message
    super.init()
  }

  override var reason: String {
    messageText
  }

  override var code: String {
    codeText
  }

  static var invalidAudioURL: VoiceTranscriberException {
    VoiceTranscriberException(code: "INVALID_AUDIO_URL", message: "Invalid audio file URL.")
  }

  static var recognizerUnavailable: VoiceTranscriberException {
    VoiceTranscriberException(
      code: "RECOGNIZER_UNAVAILABLE",
      message: "Speech recognizer unavailable for the current locale."
    )
  }

  static var missingPermission: VoiceTranscriberException {
    VoiceTranscriberException(
      code: "MISSING_PERMISSION",
      message: "Speech recognition permission is required."
    )
  }

  static var emptyTranscript: VoiceTranscriberException {
    VoiceTranscriberException(
      code: "EMPTY_TRANSCRIPT",
      message: "No speech could be transcribed from this recording."
    )
  }
}

private struct VoiceTranscriptionResult: Record {
  @Field
  var rawText: String = ""

  @Field
  var locale: String = ""

  @Field
  var engine: String = "sfspeech"

  @Field
  var isOnDevice: Bool = true
}

private final class VoiceTranscriptionTaskDelegate: NSObject, SFSpeechRecognitionTaskDelegate {
  private var task: SFSpeechRecognitionTask?
  private var didResume = false
  private let continuation: CheckedContinuation<VoiceTranscriptionResult, Error>
  private let locale: Locale
  private let isOnDevice: Bool
  // SFSpeechRecognitionTask does not retain the recognizer that created it —
  // without this, `recognizer` (a local var in transcribeAudioFile) can be
  // deallocated while the request is still in flight, silently starving the
  // task of delegate callbacks and leaving the continuation (and the JS
  // caller) hanging forever.
  private let recognizer: SFSpeechRecognizer

  init(
    continuation: CheckedContinuation<VoiceTranscriptionResult, Error>,
    locale: Locale,
    isOnDevice: Bool,
    recognizer: SFSpeechRecognizer
  ) {
    self.continuation = continuation
    self.locale = locale
    self.isOnDevice = isOnDevice
    self.recognizer = recognizer
  }

  func attachTask(_ task: SFSpeechRecognitionTask) {
    self.task = task
  }

  private func resume(throwing error: Error) {
    guard !didResume else {
      return
    }

    didResume = true
    task?.cancel()
    continuation.resume(throwing: error)
  }

  private func resume(with transcript: String) {
    guard !didResume else {
      return
    }

    didResume = true
    task?.cancel()

    guard !transcript.isEmpty else {
      continuation.resume(throwing: VoiceTranscriberException.emptyTranscript)
      return
    }

    continuation.resume(
      returning: VoiceTranscriptionResult(
        rawText: transcript,
        locale: locale.identifier,
        engine: "sfspeech",
        isOnDevice: isOnDevice
      )
    )
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didFinishRecognition recognitionResult: SFSpeechRecognitionResult) {
    let transcript = recognitionResult.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
    resume(with: transcript)
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didFinishSuccessfully successfully: Bool) {
    guard successfully else {
      resume(throwing: task.error ?? VoiceTranscriberException.emptyTranscript)
      return
    }
  }

  func speechRecognitionTaskWasCancelled(_ task: SFSpeechRecognitionTask) {
    resume(throwing: task.error ?? VoiceTranscriberException.emptyTranscript)
  }
}

private func permissionStatusString(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
  switch status {
  case .authorized:
    return "authorized"
  case .denied:
    return "denied"
  case .notDetermined:
    return "notDetermined"
  case .restricted:
    return "restricted"
  @unknown default:
    return "restricted"
  }
}

private func requestSpeechRecognitionAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
  await withCheckedContinuation { continuation in
    DispatchQueue.main.async {
      SFSpeechRecognizer.requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }
  }
}

private func transcribeAudioFile(at audioUri: String) async throws -> VoiceTranscriptionResult {
  guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
    throw VoiceTranscriberException.missingPermission
  }

  guard let fileURL = URL(string: audioUri), fileURL.isFileURL else {
    throw VoiceTranscriberException.invalidAudioURL
  }

  let locale = Locale(identifier: Locale.preferredLanguages.first ?? Locale.current.identifier)
  guard let recognizer = SFSpeechRecognizer(locale: locale) else {
    throw VoiceTranscriberException.recognizerUnavailable
  }

  // On-device speech models aren't guaranteed to be downloaded for every
  // locale/device, so prefer on-device recognition but gracefully fall back
  // to server-based recognition instead of failing outright.
  let isOnDevice = recognizer.supportsOnDeviceRecognition

  let request = SFSpeechURLRecognitionRequest(url: fileURL)
  request.shouldReportPartialResults = false
  request.requiresOnDeviceRecognition = isOnDevice

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
}

public class VoiceTranscriberModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VoiceTranscriber")

    AsyncFunction("getPermissions") { () async -> String in
      permissionStatusString(SFSpeechRecognizer.authorizationStatus())
    }

    AsyncFunction("requestPermissions") { () async -> String in
      let status = await requestSpeechRecognitionAuthorization()
      return permissionStatusString(status)
    }

    AsyncFunction("transcribeFile") { (audioUri: String) async throws -> VoiceTranscriptionResult in
      try await transcribeAudioFile(at: audioUri)
    }
  }
}
