import Foundation

/// Shared background sync coordinator for Apple platforms.
///
/// Restores the current signed-in session, refreshes notes and chats (which
/// write through to the local cache on success), and suppresses overlapping
/// sync runs. Both iOS and macOS background entry points call `sync()` —
/// platform-specific scheduling and registration live in the app targets.
public actor AppleSyncCoordinator {

    private let authService: AuthService
    private let notesStore: NotesStore
    private let chatsStore: ChatsStore
    private var isSyncing = false

    public init(
        authService: AuthService,
        notesStore: NotesStore,
        chatsStore: ChatsStore
    ) {
        self.authService = authService
        self.notesStore = notesStore
        self.chatsStore = chatsStore
    }

    // MARK: - Sync

    /// Perform a full notes + chats refresh.
    ///
    /// If a sync is already in progress this call returns immediately without
    /// issuing duplicate fetches. If no restorable session exists, the sync is
    /// skipped entirely without mutating any cached content.
    public func sync() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        // Verify a signed-in session is available before fetching
        guard let session = try? await authService.restoreSession() else { return }

        // Ensure stores know the userId so cache write-through works
        await notesStore.hydrateFromCache(userId: session.user.id)
        await chatsStore.hydrateFromCache(userId: session.user.id)

        // Refresh from network — cache write-through happens inside the stores
        await notesStore.refresh()
        await chatsStore.refresh()
    }
}
