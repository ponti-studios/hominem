import Foundation

/// Provides CRUD access to the /api/notes endpoints.
///
/// All methods require an active session in the shared `APIClient` cookie jar.
@MainActor
public final class NotesService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    // MARK: - List

    public func listNotes(query: NotesListQuery = NotesListQuery()) async throws -> [Note] {
        let output = try await client.get(
            NotesListOutput.self,
            path: "/api/notes",
            query: query.queryItems
        )
        return output.notes
    }

    // MARK: - Get

    public func getNote(id: String) async throws -> Note {
        try await client.get(Note.self, path: "/api/notes/\(id)")
    }

    // MARK: - Create

    public func createNote(input: NotesCreateInput) async throws -> Note {
        try await client.post(Note.self, path: "/api/notes", body: input)
    }

    // MARK: - Update

    public func updateNote(id: String, input: NotesUpdateInput) async throws -> Note {
        try await client.patch(Note.self, path: "/api/notes/\(id)", body: input)
    }

    // MARK: - Delete

    public func deleteNote(id: String) async throws -> Note {
        struct EmptyBody: Encodable {}
        return try await client.delete(Note.self, path: "/api/notes/\(id)", body: EmptyBody())
    }

    // MARK: - Archive

    public func archiveNote(id: String) async throws -> Note {
        try await client.post(Note.self, path: "/api/notes/\(id)/archive", body: EmptyBody())
    }

    // MARK: - Classify

    /// Sends note content to the AI classifier and returns a review item.
    /// Pass the returned `reviewItemId` to `acceptReview(reviewId:)` to persist the result.
    public func classifyNote(content: String) async throws -> ClassifyNoteOutput {
        struct Body: Encodable { let content: String }
        return try await client.post(
            ClassifyNoteOutput.self,
            path: "/api/notes/classify",
            body: Body(content: content)
        )
    }

    // MARK: - Accept Review

    public func acceptReview(reviewId: String) async throws -> Note {
        struct Body: Encodable { let reviewItemId: String }
        return try await client.post(
            Note.self,
            path: "/api/review/accept",
            body: Body(reviewItemId: reviewId)
        )
    }
}

private struct EmptyBody: Encodable {}
