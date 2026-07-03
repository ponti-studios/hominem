import ExpoModulesCore
import Foundation
import Speech
import os.log

private let voiceTranscriberLog = OSLog(subsystem: "com.hominem.omiro", category: "VoiceTranscriber")

// A single Exception type carrying a stable `code` alongside its message, so
// the JS side can branch on `error.code` (e.g. to route a revoked-permission
// failure to the same UX as the initial permission gate) instead of parsing
// free-text error messages, which are not a stable contract.
private final class VoiceTranscriberException: Exception, @unchecked Sendable {
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
  // SFSpeechRecognitionTask holds its delegate weakly.
  // Nothing outside this object survives past the
  // synchronous setup closure in transcribeAudioFile, so without this
  // self-retain the delegate — and with it any chance of a callback ever
  // firing — gets deallocated immediately after the task is created,
  // leaving the continuation (and the JS caller) hanging forever.
  private var selfRetain: VoiceTranscriptionTaskDelegate?

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
    super.init()
    self.selfRetain = self
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
    selfRetain = nil
  }

  private func resume(with transcript: String) {
    guard !didResume else {
      return
    }

    didResume = true
    task?.cancel()

    guard !transcript.isEmpty else {
      continuation.resume(throwing: VoiceTranscriberException.emptyTranscript)
      selfRetain = nil
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
    selfRetain = nil
  }

  func speechRecognitionDidDetectSpeech(_ task: SFSpeechRecognitionTask) {
    os_log("speechRecognitionDidDetectSpeech", log: voiceTranscriberLog, type: .info)
  }

  func speechRecognitionTaskFinishedReadingAudio(_ task: SFSpeechRecognitionTask) {
    os_log("speechRecognitionTaskFinishedReadingAudio", log: voiceTranscriberLog, type: .info)
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didHypothesizeTranscription transcription: SFTranscription) {
    os_log(
      "didHypothesizeTranscription: %{public}@",
      log: voiceTranscriberLog,
      type: .info,
      transcription.formattedString
    )
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didFinishRecognition recognitionResult: SFSpeechRecognitionResult) {
    let transcript = recognitionResult.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
    os_log(
      "didFinishRecognition isFinal=%{public}@ transcriptLength=%{public}d",
      log: voiceTranscriberLog,
      type: .info,
      String(recognitionResult.isFinal),
      transcript.count
    )
    resume(with: transcript)
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didFinishSuccessfully successfully: Bool) {
    os_log(
      "didFinishSuccessfully=%{public}@ taskError=%{public}@",
      log: voiceTranscriberLog,
      type: .info,
      String(successfully),
      String(describing: task.error)
    )
    guard successfully else {
      resume(throwing: task.error ?? VoiceTranscriberException.emptyTranscript)
      return
    }
  }

  func speechRecognitionTaskWasCancelled(_ task: SFSpeechRecognitionTask) {
    os_log("speechRecognitionTaskWasCancelled taskError=%{public}@", log: voiceTranscriberLog, type: .info, String(describing: task.error))
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
  os_log("transcribeAudioFile: start uri=%{public}@", log: voiceTranscriberLog, type: .info, audioUri)

  let authStatus = SFSpeechRecognizer.authorizationStatus()
  os_log("transcribeAudioFile: authStatus=%{public}@", log: voiceTranscriberLog, type: .info, permissionStatusString(authStatus))
  guard authStatus == .authorized else {
    os_log("transcribeAudioFile: missing permission, throwing", log: voiceTranscriberLog, type: .error)
    throw VoiceTranscriberException.missingPermission
  }

  guard let fileURL = URL(string: audioUri), fileURL.isFileURL else {
    os_log("transcribeAudioFile: invalid audio URL, throwing", log: voiceTranscriberLog, type: .error)
    throw VoiceTranscriberException.invalidAudioURL
  }

  let fileExists = FileManager.default.fileExists(atPath: fileURL.path)
  let fileSize = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int) ?? nil
  os_log(
    "transcribeAudioFile: fileExists=%{public}@ fileSize=%{public}@",
    log: voiceTranscriberLog,
    type: .info,
    String(fileExists),
    String(describing: fileSize)
  )

  let locale = Locale(identifier: Locale.preferredLanguages.first ?? Locale.current.identifier)
  guard let recognizer = SFSpeechRecognizer(locale: locale) else {
    os_log("transcribeAudioFile: recognizer unavailable for locale=%{public}@, throwing", log: voiceTranscriberLog, type: .error, locale.identifier)
    throw VoiceTranscriberException.recognizerUnavailable
  }

  os_log(
    "transcribeAudioFile: recognizer created locale=%{public}@ isAvailable=%{public}@ supportsOnDevice=%{public}@",
    log: voiceTranscriberLog,
    type: .info,
    locale.identifier,
    String(recognizer.isAvailable),
    String(recognizer.supportsOnDeviceRecognition)
  )

  // On-device speech models aren't guaranteed to be downloaded for every
  // locale/device, so prefer on-device recognition but gracefully fall back
  // to server-based recognition instead of failing outright.
  let isOnDevice = recognizer.supportsOnDeviceRecognition

  let request = SFSpeechURLRecognitionRequest(url: fileURL)
  request.shouldReportPartialResults = false
  request.requiresOnDeviceRecognition = isOnDevice

  os_log(
    "transcribeAudioFile: starting recognitionTask isOnDevice=%{public}@",
    log: voiceTranscriberLog,
    type: .info,
    String(isOnDevice)
  )

  return try await withCheckedThrowingContinuation { continuation in
    let delegate = VoiceTranscriptionTaskDelegate(
      continuation: continuation,
      locale: locale,
      isOnDevice: isOnDevice,
      recognizer: recognizer
    )
    let task = recognizer.recognitionTask(with: request, delegate: delegate)
    delegate.attachTask(task)
    os_log("transcribeAudioFile: recognitionTask created, awaiting delegate callbacks", log: voiceTranscriberLog, type: .info)
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
      os_log("transcribeFile AsyncFunction invoked", log: voiceTranscriberLog, type: .info)
      do {
        let result = try await transcribeAudioFile(at: audioUri)
        os_log("transcribeFile AsyncFunction resolving successfully", log: voiceTranscriberLog, type: .info)
        return result
      } catch {
        os_log("transcribeFile AsyncFunction rejecting: %{public}@", log: voiceTranscriberLog, type: .error, String(describing: error))
        throw error
      }
    }
  }
}
