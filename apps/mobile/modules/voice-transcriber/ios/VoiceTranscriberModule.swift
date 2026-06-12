import ExpoModulesCore
import Foundation
import Speech

private enum VoiceTranscriberError: LocalizedError {
  case invalidAudioURL
  case recognizerUnavailable
  case onDeviceRecognitionUnavailable
  case missingPermission
  case emptyTranscript

  var errorDescription: String? {
    switch self {
    case .invalidAudioURL:
      return "Invalid audio file URL."
    case .recognizerUnavailable:
      return "Speech recognizer unavailable for the current locale."
    case .onDeviceRecognitionUnavailable:
      return "On-device speech recognition is unavailable for the current locale."
    case .missingPermission:
      return "Speech recognition permission is required."
    case .emptyTranscript:
      return "No speech could be transcribed from this recording."
    }
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

  init(
    continuation: CheckedContinuation<VoiceTranscriptionResult, Error>,
    locale: Locale
  ) {
    self.continuation = continuation
    self.locale = locale
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
      continuation.resume(throwing: VoiceTranscriberError.emptyTranscript)
      return
    }

    continuation.resume(
      returning: VoiceTranscriptionResult(
        rawText: transcript,
        locale: locale.identifier,
        engine: "sfspeech",
        isOnDevice: true
      )
    )
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didFinishRecognition recognitionResult: SFSpeechRecognitionResult) {
    let transcript = recognitionResult.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
    resume(with: transcript)
  }

  func speechRecognitionTask(_ task: SFSpeechRecognitionTask, didFinishSuccessfully successfully: Bool) {
    guard successfully else {
      resume(throwing: task.error ?? VoiceTranscriberError.emptyTranscript)
      return
    }
  }

  func speechRecognitionTaskWasCancelled(_ task: SFSpeechRecognitionTask) {
    resume(throwing: task.error ?? VoiceTranscriberError.emptyTranscript)
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
    throw VoiceTranscriberError.missingPermission
  }

  guard let fileURL = URL(string: audioUri), fileURL.isFileURL else {
    throw VoiceTranscriberError.invalidAudioURL
  }

  let locale = Locale(identifier: Locale.preferredLanguages.first ?? Locale.current.identifier)
  guard let recognizer = SFSpeechRecognizer(locale: locale) else {
    throw VoiceTranscriberError.recognizerUnavailable
  }

  guard recognizer.supportsOnDeviceRecognition else {
    throw VoiceTranscriberError.onDeviceRecognitionUnavailable
  }

  let request = SFSpeechURLRecognitionRequest(url: fileURL)
  request.shouldReportPartialResults = false
  request.requiresOnDeviceRecognition = true

  return try await withCheckedThrowingContinuation { continuation in
    let delegate = VoiceTranscriptionTaskDelegate(continuation: continuation, locale: locale)
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
