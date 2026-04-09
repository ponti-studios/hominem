import Foundation

/// Provides access to the /api/voice endpoints for TTS and transcription.
///
/// All methods require an active session in the shared `APIClient` cookie jar.
@MainActor
public final class VoiceService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    // MARK: - Text-to-Speech

    /// Converts `text` to speech and returns raw audio bytes.
    /// The response `Content-Type` is typically `audio/mpeg` or `audio/wav`.
    public func textToSpeech(
        text: String,
        voice: String = "alloy",
        speed: Double = 1.0
    ) async throws -> Data {
        struct Body: Encodable {
            let text: String
            let voice: String
            let speed: Double
        }
        return try await client.postForData(
            path: "/api/voice/speech",
            body: Body(text: text, voice: voice, speed: speed)
        )
    }

    // MARK: - Transcription

    /// Sends an audio file at `audioURL` to the transcription endpoint
    /// and returns the recognised text.
    ///
    /// - Parameters:
    ///   - audioURL: A local file URL pointing to the recorded audio.
    ///   - mimeType: The MIME type of the audio file (e.g. `"audio/m4a"`, `"audio/mp4"`).
    public func transcribe(audioURL: URL, mimeType: String = "audio/m4a") async throws -> String {
        let output = try await client.postMultipart(
            VoiceTranscriptionOutput.self,
            path: "/api/voice/transcribe",
            fileURL: audioURL,
            mimeType: mimeType
        )
        return output.text
    }
}
