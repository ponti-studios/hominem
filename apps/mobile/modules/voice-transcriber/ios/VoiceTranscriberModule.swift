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

private func transcribeAudioFile(at audioUri: String) async throws -> String {
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
    var didResume = false
    var task: SFSpeechRecognitionTask?

    task = recognizer.recognitionTask(with: request) { result, error in
      if didResume {
        return
      }

      if let error {
        didResume = true
        task?.cancel()
        continuation.resume(throwing: error)
        return
      }

      guard let result, result.isFinal else {
        return
      }

      let transcript = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
      didResume = true
      task?.cancel()

      if transcript.isEmpty {
        continuation.resume(throwing: VoiceTranscriberError.emptyTranscript)
        return
      }

      continuation.resume(returning: transcript)
    }
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

    AsyncFunction("transcribeFile") { (audioUri: String) async throws -> String in
      try await transcribeAudioFile(at: audioUri)
    }
  }
}