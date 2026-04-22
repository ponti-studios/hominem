# Journal

- 2026-04-18T06:24:23Z: Created work item `note-editor-autosave-detach-and-chat-handoff`.
- 2026-04-18T10:30:00Z: Implemented autosave, file detachment, and chat handoff in NoteDetailScreen.
  - **Autosave**: `scheduleAutosave()` cancels the previous `Task` and schedules a new one with `Task.sleep(for: .milliseconds(600))` — matching Expo's 600 ms debounce. On cancellation the task exits silently; on completion it calls `NoteService.saveNote`. This fires on every `onChange` of title or content.
  - **Save indicator**: `SaveState` enum (`idle/saving/saved/failed`) drives a toolbar indicator — spinning ProgressView while saving, checkmark for 1.5 s after save, exclamation on error.
  - **File detachment**: attachments section renders each `NoteFile` with an × button. Tapping detaches optimistically (removes from local `files`) then calls `save(fileIds: newFileIds)` immediately (bypasses debounce, cancels pending autosave first).
  - **Chat handoff**: toolbar bubble.left button cancels pending autosave, sets `router.selectedTab = .inbox`, pushes `.chat(id: noteId)` to `router.protectedPath` to open ChatScreen in the inbox tab.
  - **TopAnchorSignal**: called after every successful save so the inbox feed scrolls to show updated note.
  - Build verified: `BUILD SUCCEEDED`.
  - Follow-up: file attachment (uploading) is future work (Phase 4 camera + attachments).
