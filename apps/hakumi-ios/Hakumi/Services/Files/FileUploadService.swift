import Foundation

// MARK: - UploadedFileResult

struct UploadedFileResult: Identifiable, Sendable, Hashable {
    let id: String
    let originalName: String
    let mimeType: String
    let url: String
}

// MARK: - FileUploadError

enum FileUploadError: LocalizedError, Sendable {
    case unsupportedType(String)
    case fileTooLarge
    case tooManyFiles
    case uploadFailed(String)

    var errorDescription: String? {
        switch self {
        case .unsupportedType(let name): "Unsupported file type: \(name)"
        case .fileTooLarge: "File exceeds the 10 MB limit."
        case .tooManyFiles: "You can upload up to 5 files at a time."
        case .uploadFailed(let reason): "Upload failed: \(reason)"
        }
    }
}

// MARK: - FileUploadService

@Observable @MainActor final class FileUploadService {
    static let shared = FileUploadService()

    static let maxFileSize = 10 * 1024 * 1024 // 10 MB
    static let maxFileCount = 5

    static let allowedMIMETypes: Set<String> = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "audio/mpeg", "audio/wav", "audio/ogg",
        "video/mp4", "video/webm",
        "text/csv", "application/csv"
    ]

    private(set) var isUploading = false

    // MARK: - Upload

    func uploadFile(data: Data, fileName: String, mimeType: String) async throws -> UploadedFileResult {
        guard FileUploadService.allowedMIMETypes.contains(mimeType) else {
            throw FileUploadError.unsupportedType(fileName)
        }
        guard data.count <= FileUploadService.maxFileSize else {
            throw FileUploadError.fileTooLarge
        }

        let boundary = UUID().uuidString
        var request = URLRequest(url: AuthService.apiURL("/api/files"))
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60
        request.applyAuthHeaders()
        request.httpBody = buildMultipartBody(data: data, fileName: fileName, mimeType: mimeType, boundary: boundary)

        let (responseData, response) = try await URLSession.shared.data(for: request)
        try URLRequest.validate(response, throwing: FileUploadError.uploadFailed("Server returned an error."))

        guard
            let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
            let fileDict = json["file"] as? [String: Any],
            let id = fileDict["id"] as? String,
            let originalName = fileDict["originalName"] as? String,
            let mimeTypeResp = fileDict["mimetype"] as? String,
            let urlStr = fileDict["url"] as? String
        else {
            throw FileUploadError.uploadFailed("Unexpected server response.")
        }

        return UploadedFileResult(id: id, originalName: originalName, mimeType: mimeTypeResp, url: urlStr)
    }

    // MARK: - Delete

    /// Best-effort file deletion. Errors are logged but not propagated — callers
    /// should not depend on this completing successfully.
    func deleteFile(id: String) async {
        var request = URLRequest(url: AuthService.apiURL("/api/files/\(id)"))
        request.httpMethod = "DELETE"
        request.timeoutInterval = 15
        request.applyAuthHeaders()
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            try URLRequest.validate(response, throwing: FileUploadError.uploadFailed("Delete returned non-2xx"))
        } catch {
            // Non-fatal — the file may already be gone or the server is unreachable.
            // Log so it can be investigated without crashing the caller.
            print("[FileUploadService] deleteFile(\(id)) failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Multipart builder

    private func buildMultipartBody(data: Data, fileName: String, mimeType: String, boundary: String) -> Data {
        var body = Data()

        func append(_ string: String) {
            if let d = string.data(using: .utf8) { body.append(d) }
        }

        let crlf = "\r\n"
        let dash = "--\(boundary)"

        // file field
        append("\(dash)\(crlf)")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\(crlf)")
        append("Content-Type: \(mimeType)\(crlf)\(crlf)")
        body.append(data)
        append(crlf)

        // originalName field
        append("\(dash)\(crlf)")
        append("Content-Disposition: form-data; name=\"originalName\"\(crlf)\(crlf)")
        append(fileName)
        append(crlf)

        // mimetype field
        append("\(dash)\(crlf)")
        append("Content-Disposition: form-data; name=\"mimetype\"\(crlf)\(crlf)")
        append(mimeType)
        append(crlf)

        append("\(dash)--\(crlf)")
        return body
    }
}
