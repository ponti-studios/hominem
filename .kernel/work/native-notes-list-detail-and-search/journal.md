# Journal

- 2026-04-18T06:24:23Z: Created work item `native-notes-list-detail-and-search`.
- 2026-04-18T10:30:00Z: Implemented notes list, detail, and search.
  - `NoteService` (`Services/Notes/NoteService.swift`): `@MainActor` enum. `NoteItem` (list model), `NoteDetail` (detail model with `[NoteFile]`), `NoteFile`. API: `GET /api/notes?sortBy=updatedAt&sortOrder=desc&limit=100`, `GET /api/notes/:id`, `POST /api/notes` (create), `PATCH /api/notes/:id` (save with optional fileIds).
  - `NotesScreen` (`Screens/Notes/NotesScreen.swift`): List with pull-to-refresh, in-memory `.searchable` filter (title + contentPreview), background stale-refresh on reappear, `+` toolbar button creates note via API and pushes via `router.notesPath`.
  - `NoteDetailScreen` — placeholder upgraded to real editor (next work item covers autosave + detach).
  - Router: added `notesPath` + `settingsPath` per-tab path bindings. Deep-link `.noteDetail` now pushes to `notesPath`, `.archivedChats` pushes to `settingsPath`.
  - RootView: all three tab NavigationStacks now bound to their respective path arrays.
  - Removed `NotesScreen` and `NoteDetailScreen` placeholder stubs from `PlaceholderScreen.swift`.
  - Build verified: `BUILD SUCCEEDED`.
