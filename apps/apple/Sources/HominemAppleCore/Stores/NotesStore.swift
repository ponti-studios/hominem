import Foundation
import Observation

/// Observable store that owns the in-memory notes list and drives Notes UI.
///
/// Wraps `NotesService` with loading/error state and optimistic local updates.
/// When a `LocalDatabase` is provided, all successful fetches and mutations are
/// written through to the cache and the cache is loaded before the first network
/// refresh so the UI has content immediately on launch.
@Observable
@MainActor
public final class NotesStore {
    public private(set) var notes: [Note] = []
    public private(set) var isLoading = false
    public private(set) var error: Error?

    private let service: NotesService
    private let database: LocalDatabase?
    private var currentUserId: String?

    public init(service: NotesService, database: LocalDatabase? = nil) {
        self.service = service
        self.database = database
    }

    // MARK: - Cache Hydration

    /// Load notes from the local cache so the UI has content before the network
    /// refresh completes. Silently ignores cache misses or read errors.
    public func hydrateFromCache(userId: String) async {
        currentUserId = userId
        guard let database else { return }
        let cached = (try? await database.readNotes(userId: userId)) ?? []
        if !cached.isEmpty {
            notes = cached
        }
    }

    /// Remove all persisted notes for the current user.
    public func clearCache(userId: String) async {
        currentUserId = nil
        notes = []
        try? await database?.clearNotes(userId: userId)
    }

    // MARK: - Fetch

    public func refresh(query: NotesListQuery = NotesListQuery()) async {
        isLoading = true
        error = nil
        do {
            let fetched = try await service.listNotes(query: query)
            notes = fetched
            // Write through to cache on success
            if let userId = currentUserId {
                try? await database?.writeNotes(fetched, userId: userId)
            }
        } catch {
            // Preserve existing (possibly cached) notes on failure
            self.error = error
        }
        isLoading = false
    }

    // MARK: - Create

    @discardableResult
    public func createNote(_ input: NotesCreateInput) async throws -> Note {
        let note = try await service.createNote(input: input)
        notes.insert(note, at: 0)
        try? await database?.upsertNote(note)
        return note
    }

    // MARK: - Update (optimistic)

    @discardableResult
    public func updateNote(id: String, input: NotesUpdateInput) async throws -> Note {
        let updated = try await service.updateNote(id: id, input: input)
        if let idx = notes.firstIndex(where: { $0.id == id }) {
            notes[idx] = updated
        }
        try? await database?.upsertNote(updated)
        return updated
    }

    // MARK: - Delete (optimistic)

    public func deleteNote(id: String) async throws {
        notes.removeAll { $0.id == id }
        if let userId = currentUserId {
            try? await database?.deleteNote(id: id, userId: userId)
        }
        do {
            _ = try await service.deleteNote(id: id)
        } catch {
            // Roll back in-memory state on failure
            await refresh()
            throw error
        }
    }

    // MARK: - Archive

    @discardableResult
    public func archiveNote(id: String) async throws -> Note {
        let archived = try await service.archiveNote(id: id)
        if let idx = notes.firstIndex(where: { $0.id == id }) {
            notes[idx] = archived
        }
        try? await database?.upsertNote(archived)
        return archived
    }

    // MARK: - Local lookup

    public func note(id: String) -> Note? {
        notes.first { $0.id == id }
    }

    public func clearError() {
        error = nil
    }
}
