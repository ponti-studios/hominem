import Foundation

// MARK: - AppStores
//
// Singleton registry of all QueryStore instances.
// Screens observe these stores directly; the composer writes to them on submit.
// Sharing one instance per resource type means every screen sees the same
// cached data and benefits from the same stale-time window.

@Observable @MainActor
final class AppStores {

    static let shared = AppStores()

    let inbox: QueryStore<InboxItem>
    let notes: QueryStore<NoteItem>

    private init() {
        inbox = QueryStore(staleTime: 30) {
            try await InboxService.fetchItems()
        }
        notes = QueryStore(staleTime: 30) {
            try await NoteService.fetchNotes()
        }
    }
}
