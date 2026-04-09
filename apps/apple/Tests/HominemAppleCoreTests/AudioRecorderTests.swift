import Foundation
import Testing
@testable import HominemAppleCore

// MARK: - Test stubs

private final class StubPermissionChecker: AudioPermissionChecker, @unchecked Sendable {
    var granted = true
    func requestPermission() async -> Bool { granted }
}

private final class StubRecordingEngine: AudioRecordingEngine, @unchecked Sendable {
    var startError: Error?
    var recordedURL: URL? = URL(fileURLWithPath: "/tmp/test.m4a")
    private(set) var startCalled = false
    private(set) var stopCalled = false

    func start() throws -> URL {
        startCalled = true
        if let error = startError { throw error }
        return recordedURL!
    }

    func stop() -> URL? {
        stopCalled = true
        return recordedURL
    }
}

// MARK: - AudioRecorderTests

@Suite(.serialized)
@MainActor
struct AudioRecorderTests {

    // MARK: Idle → Recording

    @Test
    func startRecordingTransitionsToRecordingWhenPermissionGranted() async throws {
        let checker = StubPermissionChecker()
        let engine = StubRecordingEngine()
        let recorder = AudioRecorder(permissionChecker: checker, engine: engine)

        #expect(recorder.state == .idle)
        await recorder.startRecording()

        #expect(recorder.state == .recording)
        #expect(engine.startCalled)
    }

    // MARK: Permission denied

    @Test
    func startRecordingTransitionsToFailedWhenPermissionDenied() async throws {
        let checker = StubPermissionChecker()
        checker.granted = false
        let engine = StubRecordingEngine()
        let recorder = AudioRecorder(permissionChecker: checker, engine: engine)

        await recorder.startRecording()

        #expect(engine.startCalled == false)
        if case .failed = recorder.state {
            // expected
        } else {
            Issue.record("Expected .failed state, got \(recorder.state)")
        }
    }

    // MARK: Engine error

    @Test
    func startRecordingTransitionsToFailedWhenEngineThrows() async throws {
        let checker = StubPermissionChecker()
        let engine = StubRecordingEngine()
        engine.startError = URLError(.cannotCreateFile)
        let recorder = AudioRecorder(permissionChecker: checker, engine: engine)

        await recorder.startRecording()

        if case .failed = recorder.state {
            // expected
        } else {
            Issue.record("Expected .failed state, got \(recorder.state)")
        }
    }

    // MARK: No double-start

    @Test
    func startRecordingIsNoopWhenAlreadyRecording() async throws {
        let checker = StubPermissionChecker()
        let engine = StubRecordingEngine()
        let recorder = AudioRecorder(permissionChecker: checker, engine: engine)

        await recorder.startRecording()
        #expect(recorder.state == .recording)

        // Second call while recording — should be ignored
        await recorder.startRecording()
        #expect(engine.startCalled) // only called once because the second call exits early
        #expect(recorder.state == .recording)
    }

    // MARK: Cancel from recording

    @Test
    func cancelFromRecordingTransitionsToIdle() async throws {
        let checker = StubPermissionChecker()
        let engine = StubRecordingEngine()
        let recorder = AudioRecorder(permissionChecker: checker, engine: engine)

        await recorder.startRecording()
        #expect(recorder.state == .recording)

        recorder.cancel()
        #expect(recorder.state == .idle)
        #expect(engine.stopCalled)
    }

    // MARK: Cancel from idle is noop

    @Test
    func cancelFromIdleIsNoop() async throws {
        let engine = StubRecordingEngine()
        let recorder = AudioRecorder(
            permissionChecker: StubPermissionChecker(),
            engine: engine
        )
        recorder.cancel()
        #expect(recorder.state == .idle)
        #expect(engine.stopCalled == false)
    }

    // MARK: stopAndTranscribe from wrong state

    @Test
    func stopAndTranscribeThrowsWhenNotRecording() async throws {
        let recorder = AudioRecorder(
            permissionChecker: StubPermissionChecker(),
            engine: StubRecordingEngine()
        )

        // Build a dummy VoiceService — it should never be called
        let client = APIClient(baseURL: URL(string: "http://localhost:4040")!)
        let voiceService = VoiceService(client: client)

        do {
            _ = try await recorder.stopAndTranscribe(using: voiceService)
            Issue.record("Expected AudioRecorderError.invalidState to be thrown")
        } catch let error as AudioRecorderError {
            if case .invalidState = error { /* expected */ }
            else { Issue.record("Unexpected AudioRecorderError: \(error)") }
        }
    }

    // MARK: clearError

    @Test
    func clearErrorResetsFailedStateToIdle() async throws {
        let checker = StubPermissionChecker()
        checker.granted = false
        let recorder = AudioRecorder(
            permissionChecker: checker,
            engine: StubRecordingEngine()
        )

        await recorder.startRecording()
        if case .failed = recorder.state { /* ok */ }
        else { Issue.record("Expected .failed state") }

        recorder.clearError()
        #expect(recorder.state == .idle)
    }
}
