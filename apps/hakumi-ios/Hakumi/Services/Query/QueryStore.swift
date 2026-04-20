import Foundation

// MARK: - QueryStore
//
// Generic observable data store modelled after TanStack Query's core concepts:
//   - Cached data with a configurable stale time
//   - Background re-fetch when data is stale (on appear / tab switch)
//   - Optimistic mutations: immediate UI update → API call → commit or rollback
//
// Usage:
//   let store = QueryStore<NoteItem>(staleTime: 30) { try await NoteService.fetchNotes() }
//   await store.fetch()                         // full reload
//   store.fetchIfStale()                        // no-op if data is fresh
//   try await store.prepend(placeholder: tmp) { try await api.create(...) }

@Observable @MainActor
final class QueryStore<Item: Identifiable & Sendable> {

    // MARK: - Status

    enum Status: Equatable {
        case idle
        case loading
        case success
        case failure(String)

        var isLoading: Bool {
            if case .loading = self { return true }
            return false
        }

        var errorMessage: String? {
            if case .failure(let msg) = self { return msg }
            return nil
        }
    }

    // MARK: - State

    private(set) var data: [Item] = []
    private(set) var status: Status = .idle
    private(set) var lastFetchedAt: Date? = nil

    let staleTime: TimeInterval
    private let fetcher: () async throws -> [Item]

    // MARK: - Init

    init(staleTime: TimeInterval = 30, fetcher: @escaping () async throws -> [Item]) {
        self.staleTime = staleTime
        self.fetcher = fetcher
    }

    // MARK: - Computed

    /// True while loading with no cached data — use to show a full-screen skeleton.
    var isFirstLoad: Bool { status.isLoading && data.isEmpty }

    /// True when data is empty and not currently loading.
    var isEmpty: Bool { data.isEmpty && !status.isLoading }

    var errorMessage: String? { status.errorMessage }

    var isStale: Bool {
        guard let date = lastFetchedAt else { return true }
        return Date().timeIntervalSince(date) > staleTime
    }

    // MARK: - Fetch

    /// Full fetch — replaces data with the server response.
    func fetch() async {
        guard !status.isLoading else { return }
        status = .loading
        do {
            let fresh = try await fetcher()
            data = fresh
            status = .success
            lastFetchedAt = Date()
        } catch {
            status = .failure(error.localizedDescription)
        }
    }

    /// Triggers a fetch only if the cached data is older than `staleTime`.
    func fetchIfStale() {
        guard isStale else { return }
        Task { await fetch() }
    }

    // MARK: - Optimistic mutation
    //
    // 1. `optimistic` is applied to data immediately (user sees the change at once).
    // 2. The `mutation` API call fires.
    // 3a. On success: `commit` is called with the server result to reconcile data.
    // 3b. On failure: `data` is restored to the snapshot taken before step 1.

    @discardableResult
    func mutate<R: Sendable>(
        optimistic: ([Item]) -> [Item],
        mutation: () async throws -> R,
        rollback: ([Item]) -> [Item],
        commit: (R, inout [Item]) -> Void
    ) async throws -> R {
        let snapshot = data
        data = optimistic(data)
        do {
            let result = try await mutation()
            commit(result, &data)
            lastFetchedAt = Date()
            return result
        } catch {
            data = rollback(snapshot)
            throw error
        }
    }

    // MARK: - Prepend convenience
    //
    // Optimistically prepends `placeholder`, calls `mutation`, then:
    //   • On success — replaces the placeholder with the server-returned item.
    //   • On failure — removes the placeholder and rethrows.

    @discardableResult
    func prepend(
        placeholder: Item,
        mutation: () async throws -> Item
    ) async throws -> Item {
        try await mutate(
            optimistic: { [placeholder] + $0 },
            mutation: mutation,
            rollback: { items in items.filter { $0.id != placeholder.id } },
            commit: { serverItem, items in
                if let idx = items.firstIndex(where: { $0.id == placeholder.id }) {
                    items[idx] = serverItem
                } else {
                    items.insert(serverItem, at: 0)
                }
            }
        )
    }

    // MARK: - Imperative data mutation
    //
    // For cases where the caller manages the optimistic state directly
    // (e.g. createAndOpen in NotesScreen inserts then navigates).

    func mutateData(_ transform: (inout [Item]) -> Void) {
        transform(&data)
    }
}
