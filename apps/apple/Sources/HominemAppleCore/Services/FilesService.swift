import Foundation

/// Handles file upload and management via the /api/files endpoints.
///
/// Upload flow:
///   1. `prepareUpload(input:)` — obtain a pre-signed S3 URL and a `fileId`
///   2. `uploadToS3(url:data:mimeType:)` — PUT the raw bytes to S3 (no auth cookies)
///   3. `completeUpload(input:)` — notify the API that the upload finished (triggers processing)
@MainActor
public final class FilesService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    // MARK: - Prepare

    public func prepareUpload(input: FilePrepareUploadInput) async throws -> FilePrepareUploadOutput {
        try await client.post(FilePrepareUploadOutput.self, path: "/api/files/prepare-upload", body: input)
    }

    // MARK: - S3 Upload (no auth)

    public func uploadToS3(url: URL, data: Data, mimeType: String) async throws {
        try await client.upload(to: url, data: data, mimeType: mimeType)
    }

    // MARK: - Complete

    public func completeUpload(input: FileCompleteUploadInput) async throws -> UploadedFile {
        let output = try await client.post(
            FileCompleteUploadOutput.self,
            path: "/api/files/complete-upload",
            body: input
        )
        return output.file
    }

    // MARK: - Delete

    public func deleteFile(id: String) async throws {
        struct Body: Encodable { let fileId: String }
        _ = try await client.delete(
            FileDeleteOutput.self,
            path: "/api/files/\(id)",
            body: Body(fileId: id)
        )
    }

    // MARK: - Convenience: full upload

    /// Performs the full three-step upload in sequence and returns the processed file record.
    public func upload(
        data: Data,
        originalName: String,
        mimeType: String
    ) async throws -> UploadedFile {
        let prepared = try await prepareUpload(
            input: FilePrepareUploadInput(
                originalName: originalName,
                mimetype: mimeType,
                size: data.count
            )
        )

        guard let s3URL = URL(string: prepared.uploadUrl) else {
            throw FilesServiceError.invalidUploadURL
        }

        try await uploadToS3(url: s3URL, data: data, mimeType: mimeType)

        return try await completeUpload(
            input: FileCompleteUploadInput(
                fileId: prepared.fileId,
                key: prepared.key,
                originalName: prepared.originalName,
                mimetype: prepared.mimetype,
                size: prepared.size
            )
        )
    }
}

// MARK: - Errors

public enum FilesServiceError: Error, LocalizedError {
    case invalidUploadURL

    public var errorDescription: String? {
        switch self {
        case .invalidUploadURL:
            return "The server returned an invalid upload URL."
        }
    }
}
