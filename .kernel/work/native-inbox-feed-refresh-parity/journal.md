# Journal

- 2026-04-18T06:24:23Z: Created work item `native-inbox-feed-refresh-parity`.
- 2026-04-18T10:00:00Z: Implemented inbox feed.
  - `InboxService` (`Services/Inbox/InboxService.swift`): `@MainActor` enum, fetches `GET /api/chats?limit=50` + `GET /api/notes?sortBy=updatedAt&sortOrder=desc&limit=100` concurrently, merges into `[InboxItem]` sorted by updatedAt desc.
  - `InboxScreen` (`Screens/Inbox/InboxScreen.swift`): real screen with pull-to-refresh (`.refreshable`), loading/empty/error states, `NavigationLink(value:)` rows tapping to `.chat(id:)` or `.noteDetail(id:)`.
  - Added `navigationDestination(for: ProtectedRoute.self)` to inbox tab in `RootView.swift`.
  - Removed `InboxScreen` placeholder stub from `PlaceholderScreen.swift`.
  - Build verified: `BUILD SUCCEEDED`.
  - Follow-up: scroll restoration / top-anchor handled by `top-anchor-scroll-restoration-and-inbox-sync`.
