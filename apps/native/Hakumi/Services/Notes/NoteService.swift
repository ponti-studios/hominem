import Foundation

// MARK: - Models

struct NoteFile: Identifiable, Sendable {
    let id: String
    let originalName: String
    let url: String
}

struct NoteItem: Identifiable, Sendable {
    let id: String
    let title: String?
    let content: String
    let createdAt: Date
    let updatedAt: Date
    let hasAttachments: Bool

    var displayTitle: String {
        let t = title?.trimmingCharacters(in: .whitespaces) ?? ""
        return t.isEmpty ? "Untitled note" : t
    }

    var contentPreview: String {
        let stripped = content
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !stripped.isEmpty else { return "" }
        let idx = stripped.index(stripped.startIndex, offsetBy: min(160, stripped.count))
        return String(stripped[..<idx])
    }
}

struct NoteDetail: Identifiable, Sendable {
    let id: String
    var title: String?
    var content: String
    var files: [NoteFile]
    let createdAt: Date
    let updatedAt: Date
}

// MARK: - NoteService

@MainActor
enum NoteService {

    // MARK: - GET /api/notes?sortBy=updatedAt&sortOrder=desc&limit=100

    static func fetchNotes() async throws -> [NoteItem] {
        let url = URL(string: AuthService.apiURL("/api/notes").absoluteString
            + "?sortBy=updatedAt&sortOrder=desc&limit=100")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NoteError.fetchFailed
        }

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let arr = json["notes"] as? [[String: Any]]
        else { return [] }

        return arr.compactMap(noteItemFromDict)
    }

    // MARK: - GET /api/notes/:id

    static func fetchNote(id: String) async throws -> NoteDetail {
        let url = AuthService.apiURL("/api/notes/\(id)")
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NoteError.fetchFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let detail = noteDetailFromDict(dict)
        else { throw NoteError.invalidResponse }

        return detail
    }

    // MARK: - POST /api/notes (empty)

    static func createNote() async throws -> NoteDetail {
        let url = AuthService.apiURL("/api/notes")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["content": ""])
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NoteError.saveFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let detail = noteDetailFromDict(dict)
        else { throw NoteError.invalidResponse }

        return detail
    }

    // MARK: - POST /api/notes (with content)

    /// Creates a note seeded with content from the composer, optionally attaching uploaded files.
    static func createNoteWithContent(content: String, fileIds: [String]? = nil) async throws -> NoteDetail {
        let url = AuthService.apiURL("/api/notes")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = ["content": content]
        if let fileIds { body["fileIds"] = fileIds }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NoteError.saveFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let detail = noteDetailFromDict(dict)
        else { throw NoteError.invalidResponse }

        return detail
    }

    // MARK: - PATCH /api/notes/:id

    static func saveNote(id: String, title: String?, content: String, fileIds: [String]? = nil) async throws -> NoteDetail {
        let url = AuthService.apiURL("/api/notes/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15
        for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

        var body: [String: Any] = ["content": content]
        if let title { body["title"] = title } else { body["title"] = NSNull() }
        if let fileIds { body["fileIds"] = fileIds }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NoteError.saveFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let detail = noteDetailFromDict(dict)
        else { throw NoteError.invalidResponse }

        return detail
    }

    // MARK: - Helpers

    private static func noteItemFromDict(_ dict: [String: Any]) -> NoteItem? {
        guard
            let id = dict["id"] as? String,
            let updatedStr = dict["updatedAt"] as? String,
            let updatedAt = parseDate(updatedStr)
        else { return nil }

        let createdAt = (dict["createdAt"] as? String).flatMap(parseDate) ?? updatedAt
        let content = dict["content"] as? String ?? ""
        let files = dict["files"] as? [[String: Any]] ?? []

        return NoteItem(
            id: id,
            title: dict["title"] as? String,
            content: content,
            createdAt: createdAt,
            updatedAt: updatedAt,
            hasAttachments: !files.isEmpty
        )
    }

    private static func noteDetailFromDict(_ dict: [String: Any]) -> NoteDetail? {
        guard
            let id = dict["id"] as? String,
            let updatedStr = dict["updatedAt"] as? String,
            let updatedAt = parseDate(updatedStr)
        else { return nil }

        let createdAt = (dict["createdAt"] as? String).flatMap(parseDate) ?? updatedAt

        let files: [NoteFile] = (dict["files"] as? [[String: Any]] ?? []).compactMap { f in
            guard let fid = f["id"] as? String,
                  let name = f["originalName"] as? String else { return nil }
            return NoteFile(id: fid, originalName: name, url: f["url"] as? String ?? "")
        }

        return NoteDetail(
            id: id,
            title: dict["title"] as? String,
            content: dict["content"] as? String ?? "",
            files: files,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    private static func parseDate(_ string: String) -> Date? {
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: string) { return d }
        let noFrac = ISO8601DateFormatter()
        noFrac.formatOptions = [.withInternetDateTime]
        return noFrac.date(from: string)
    }
}

// MARK: - NoteError

enum NoteError: LocalizedError {
    case fetchFailed
    case saveFailed
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .fetchFailed:   "Failed to load notes."
        case .saveFailed:    "Failed to save note."
        case .invalidResponse: "Unexpected response from server."
        }
    }
}
