import Foundation

// MARK: - Prepare Upload

public struct FilePrepareUploadInput: Encodable, Sendable {
    public let originalName: String
    public let mimetype: String
    public let size: Int

    public init(originalName: String, mimetype: String, size: Int) {
        self.originalName = originalName
        self.mimetype = mimetype
        self.size = size
    }
}

public struct FilePrepareUploadOutput: Decodable, Sendable {
    public let fileId: String
    public let key: String
    public let originalName: String
    public let mimetype: String
    public let size: Int
    public let uploadUrl: String
    public let headers: [String: String]
    public let url: String
    public let uploadedAt: String
    public let expiresAt: String
}

// MARK: - Complete Upload

public struct FileCompleteUploadInput: Encodable, Sendable {
    public let fileId: String
    public let key: String
    public let originalName: String
    public let mimetype: String
    public let size: Int

    public init(fileId: String, key: String, originalName: String, mimetype: String, size: Int) {
        self.fileId = fileId
        self.key = key
        self.originalName = originalName
        self.mimetype = mimetype
        self.size = size
    }
}

public struct UploadedFile: Codable, Identifiable, Sendable, Equatable {
    public let id: String
    public let originalName: String
    public let type: String
    public let mimetype: String
    public let size: Int
    public let content: String?
    public let textContent: String?
    public let url: String
    public let uploadedAt: String
}

public struct FileCompleteUploadOutput: Decodable, Sendable {
    public let success: Bool
    public let file: UploadedFile
    public let message: String
}

// MARK: - Delete

public struct FileDeleteOutput: Decodable, Sendable {
    public let success: Bool
    public let message: String
}

// MARK: - Voice Transcription

public struct VoiceTranscriptionOutput: Decodable, Sendable {
    public let text: String
    public let language: String?
    public let duration: Double?
}
