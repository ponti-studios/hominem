import AVFoundation
import Foundation
import Observation

// MARK: - State machine

public enum AudioRecorderState: Equatable, Sendable {
    case idle
    case requestingPermission
    case recording
    case stopping
    case transcribing
    case failed(String)

    public var isActive: Bool {
        switch self {
        case .recording, .stopping, .transcribing: true
        default: false
        }
    }

    public var errorMessage: String? {
        if case .failed(let msg) = self { return msg }
        return nil
    }
}

// MARK: - Permission abstraction (injectable for tests)

public protocol AudioPermissionChecker: Sendable {
    func requestPermission() async -> Bool
}

public struct LiveAudioPermissionChecker: AudioPermissionChecker {
    public init() {}

    public func requestPermission() async -> Bool {
        #if os(iOS)
        return await AVAudioApplication.requestRecordPermission()
        #else
        // macOS: use continuation-based API
        return await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted)
            }
        }
        #endif
    }
}

// MARK: - Recording engine abstraction (injectable for tests)

public protocol AudioRecordingEngine: Sendable {
    /// Start recording to a temp file. Returns the file URL.
    func start() throws -> URL
    /// Stop recording and return the recorded file URL (or nil if nothing was captured).
    func stop() -> URL?
}

public final class LiveAudioRecordingEngine: AudioRecordingEngine, @unchecked Sendable {
    private var recorder: AVAudioRecorder?
    private var currentURL: URL?

    public init() {}

    public func start() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("m4a")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        let rec = try AVAudioRecorder(url: url, settings: settings)
        rec.record()
        recorder = rec
        currentURL = url
        return url
    }

    public func stop() -> URL? {
        recorder?.stop()
        recorder = nil
        let url = currentURL
        currentURL = nil
        return url
    }
}

// MARK: - AudioRecorder

/// Observable audio recorder with a clean state machine.
///
/// State transitions:
///   idle → requestingPermission → recording → stopping → transcribing → idle
///
/// Designed for injection of `permissionChecker` and `engine` for unit tests.
@Observable
@MainActor
public final class AudioRecorder {
    public private(set) var state: AudioRecorderState = .idle
    public private(set) var meterLevel: Float = 0

    private let permissionChecker: any AudioPermissionChecker
    private let engine: any AudioRecordingEngine
    private var meterTask: Task<Void, Never>?
    private var recordingURL: URL?

    public init(
        permissionChecker: any AudioPermissionChecker = LiveAudioPermissionChecker(),
        engine: any AudioRecordingEngine = LiveAudioRecordingEngine()
    ) {
        self.permissionChecker = permissionChecker
        self.engine = engine
    }

    // MARK: - Public API

    public func startRecording() async {
        guard state == .idle else { return }

        state = .requestingPermission
        let granted = await permissionChecker.requestPermission()

        guard granted else {
            state = .failed("Microphone access denied. Enable it in Settings.")
            return
        }

        do {
            recordingURL = try engine.start()
            state = .recording
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Stop recording and transcribe via `VoiceService`. Returns the transcript.
    public func stopAndTranscribe(using voiceService: VoiceService) async throws -> String {
        guard state == .recording else {
            throw AudioRecorderError.invalidState(state)
        }

        state = .stopping
        meterTask?.cancel()
        meterTask = nil
        meterLevel = 0

        guard let url = engine.stop() else {
            state = .idle
            throw AudioRecorderError.noRecording
        }

        state = .transcribing
        do {
            let transcript = try await voiceService.transcribe(audioURL: url)
            state = .idle
            // Clean up temp file
            try? FileManager.default.removeItem(at: url)
            return transcript
        } catch {
            state = .failed(error.localizedDescription)
            throw error
        }
    }

    /// Cancel and discard any active recording.
    public func cancel() {
        guard state.isActive else { return }
        meterTask?.cancel()
        meterTask = nil
        meterLevel = 0
        if let url = engine.stop() {
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil
        state = .idle
    }

    public func clearError() {
        if case .failed = state { state = .idle }
    }
}

// MARK: - Errors

public enum AudioRecorderError: Error, LocalizedError {
    case invalidState(AudioRecorderState)
    case noRecording

    public var errorDescription: String? {
        switch self {
        case .invalidState(let s):
            return "Cannot perform this action in state \(s)."
        case .noRecording:
            return "No audio was captured."
        }
    }
}
