# Journal

- 2026-04-18T06:24:23Z: Created work item `note-mentions-draft-restore-and-submit-actions`.
- 2026-04-19T00:00:00Z: Implemented in ComposerState: @mention detection via `getTrailingMentionQuery` (last @ preceded by whitespace/start), async note search against `GET /api/notes/search?query=...&limit=5`, `addNote` strips the @mention tail from draftText after selection, draft persistence/restore via UserDefaults keyed by target. `submitPrimary` handles feed/notes → `NoteService.createNoteWithContent` + `TopAnchorSignal.inbox.request()`, and chat → `ChatService.sendMessage` + `messageSentChatId`/`messageSentCount` signals. `submitSecondary` on feed creates a new chat and navigates to it. BUILD SUCCEEDED.
