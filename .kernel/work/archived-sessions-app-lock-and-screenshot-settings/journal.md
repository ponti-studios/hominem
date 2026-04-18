# Journal

- 2026-04-18T06:24:23Z: Created work item `archived-sessions-app-lock-and-screenshot-settings`.
- 2026-04-18T11:00:00Z: Implemented archived sessions, app lock, and screenshot settings parity.
  - `ScreenCaptureService` (`Services/Settings/ScreenCaptureService.swift`): `@Observable @MainActor` singleton storing `isPreventingScreenshots` in UserDefaults. Settings toggle drives this preference; full enforcement (UITextField overlay or `.privacySensitive()` propagation) is deferred per brief.
  - `ArchivedChatsScreen` (`Screens/Settings/ArchivedChatsScreen.swift`): fetches `GET /api/chats?limit=100`, filters by `archivedAt != nil`, sorts by archived date desc. Rows navigate to `ChatScreen` via `router.protectedPath.append(.chat(id:))` + `router.selectedTab = .inbox`. Empty state matches Expo design (label + title + description + bordered empty card). Removed old `Navigation/ArchivedChatsScreen.swift` Phase 1 placeholder.
  - App lock toggle in `SettingsScreen` wires directly to `AppLock.shared.isEnabled`.
  - `ChatScreen` moved from `Navigation/ChatScreen.swift` (Phase 1 placeholder) to `Screens/Chat/ChatScreen.swift` (clean Phase 3 placeholder pending Phase 4 implementation).
  - Build verified: `BUILD SUCCEEDED`.
  - Follow-up: screenshot enforcement and app-lock enforcement together belong in Phase 5 `device-control-and-telemetry-parity` work item.
