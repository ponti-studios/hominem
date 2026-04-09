import AVFoundation
import Foundation
import Observation

// MARK: - TTSPlayerState

public enum TTSPlayerState: Equatable, Sendable {
    case idle
    case loading
    case playing
    case failed(String)
}

// MARK: - TTSPlayer

/// Observable text-to-speech player backed by `VoiceService`.
///
/// Audio data is cached in memory by text hash so repeated requests
/// for the same phrase never hit the network.
///
/// Usage:
/// ```swift
/// let player = TTSPlayer(voiceService: voiceService)
/// await player.speak("Hello, world!")
/// player.stop()
/// ```
@Observable
@MainActor
public final class TTSPlayer: NSObject {
    // MARK: Public state

    public private(set) var state: TTSPlayerState = .idle
    public private(set) var currentText: String?

    // MARK: Private

    private let voiceService: VoiceService
    private var audioPlayer: AVAudioPlayer?
    private let cache = NSCache<NSString, NSData>()

    public init(voiceService: VoiceService, maxCacheItems: Int = 50) {
        self.voiceService = voiceService
        cache.countLimit = maxCacheItems
    }

    // MARK: - Public API

    /// Fetch (or load from cache) and play `text`.
    /// If audio is already playing for the same text, this is a no-op.
    /// If different text is playing, it stops first.
    public func speak(_ text: String, voice: String = "alloy", speed: Double = 1.0) async {
        guard text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else { return }

        // Already playing the same text — no-op
        if case .playing = state, currentText == text { return }

        stop()

        currentText = text
        state = .loading

        let cacheKey = cacheKey(for: text, voice: voice, speed: speed)

        do {
            let data: Data
            if let cached = cache.object(forKey: cacheKey) {
                data = cached as Data
            } else {
                let fetched = try await voiceService.textToSpeech(text: text, voice: voice, speed: speed)
                cache.setObject(fetched as NSData, forKey: cacheKey)
                data = fetched
            }

            // State may have changed while we were awaiting
            guard state == .loading, currentText == text else { return }

            let player = try AVAudioPlayer(data: data)
            player.delegate = self
            player.prepareToPlay()
            player.play()
            audioPlayer = player
            state = .playing
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Stop playback immediately and reset to idle.
    public func stop() {
        audioPlayer?.stop()
        audioPlayer = nil
        currentText = nil
        state = .idle
    }

    /// Toggle playback for `text`: plays if idle/failed, stops if already playing.
    public func toggle(_ text: String, voice: String = "alloy", speed: Double = 1.0) async {
        if case .playing = state, currentText == text {
            stop()
        } else {
            await speak(text, voice: voice, speed: speed)
        }
    }

    /// Clear all cached audio data.
    public func clearCache() {
        cache.removeAllObjects()
    }

    // MARK: - Private

    private func cacheKey(for text: String, voice: String, speed: Double) -> NSString {
        "\(voice)|\(speed)|\(text)" as NSString
    }
}

// MARK: - AVAudioPlayerDelegate

extension TTSPlayer: AVAudioPlayerDelegate {
    public nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        let playerID = ObjectIdentifier(player)
        Task { @MainActor in
            if let current = self.audioPlayer, ObjectIdentifier(current) == playerID {
                self.audioPlayer = nil
                self.currentText = nil
                self.state = .idle
            }
        }
    }

    public nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        let playerID = ObjectIdentifier(player)
        let message = error?.localizedDescription ?? "Audio decode error"
        Task { @MainActor in
            if let current = self.audioPlayer, ObjectIdentifier(current) == playerID {
                self.audioPlayer = nil
                self.state = .failed(message)
            }
        }
    }
}
