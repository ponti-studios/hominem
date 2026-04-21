import AVFoundation
import Speech
import Observation

// MARK: - VoiceRecordingService
//
// Wraps AVAudioEngine + SFSpeechRecognizer for live speech-to-text.
// Transcript is updated incrementally as the user speaks.
// Amplitude (0…1) drives the waveform animation in SharedComposerCard.
//
// Usage:
//   await VoiceRecordingService.shared.startRecording()
//   // user speaks …
//   let text = VoiceRecordingService.shared.stopRecording()

@Observable @MainActor
final class VoiceRecordingService {

    static let shared = VoiceRecordingService()

    // MARK: - Observable state

    private(set) var isRecording = false
    private(set) var transcript = ""
    private(set) var amplitude: Float = 0   // 0…1
    private(set) var permissionError: String? = nil

    // MARK: - Private

    private var audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private init() {}

    // MARK: - Start

    func startRecording() async {
        guard await requestPermissions() else { return }

        transcript = ""
        permissionError = nil
        isRecording = true

        let recognizer = SFSpeechRecognizer(locale: Locale.current)
        guard recognizer?.isAvailable == true else {
            permissionError = "Speech recognition is not available on this device."
            isRecording = false
            return
        }

        do {
            #if !targetEnvironment(macCatalyst)
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            #endif

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            recognitionRequest = request

            // Install a single tap: feed audio to recognizer and compute RMS for waveform
            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)

                // Compute RMS amplitude for waveform animation
                guard let channelData = buffer.floatChannelData?[0] else { return }
                let frameCount = Int(buffer.frameLength)
                guard frameCount > 0 else { return }
                var sumSquares: Float = 0
                for i in 0..<frameCount { sumSquares += channelData[i] * channelData[i] }
                let rms = (sumSquares / Float(frameCount)).squareRoot()
                Task { @MainActor [weak self] in
                    guard let self, self.isRecording else { return }
                    self.amplitude = min(1, rms * 50)
                }
            }

            audioEngine.prepare()
            try audioEngine.start()

            recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    Task { @MainActor in
                        self.transcript = result.bestTranscription.formattedString
                    }
                }
                if error != nil || result?.isFinal == true {
                    Task { @MainActor [weak self] in
                        self?.stopEngine()
                    }
                }
            }

        } catch {
            isRecording = false
            permissionError = "Could not start recording: \(error.localizedDescription)"
        }
    }

    // MARK: - Stop

    /// Stop recording and return the final transcript.
    @discardableResult
    func stopRecording() -> String {
        let result = transcript
        stopEngine()
        return result
    }

    // MARK: - Private helpers

    private func stopEngine() {
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }

        recognitionRequest?.endAudio()
        recognitionRequest = nil

        recognitionTask?.cancel()
        recognitionTask = nil

        #if !targetEnvironment(macCatalyst)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif

        isRecording = false
        amplitude = 0
    }

    private func requestPermissions() async -> Bool {
        // Microphone (iOS 17+ API; deployment target is 18.0)
        let micGranted = await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
        guard micGranted else {
            permissionError = "Microphone access is required for voice input. Enable it in Settings."
            return false
        }

        // Speech recognition
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard speechStatus == .authorized else {
            permissionError = "Speech recognition access is required for voice input. Enable it in Settings."
            return false
        }

        return true
    }
}
