# Composer and Inbox — UX Specification

This document defines the expected end-to-end behavior of the composer and inbox surfaces in plain experience terms. It is the source of truth for deciding what to build, fix, or leave alone.

---

## Mental model

The app has one composer. It floats at the bottom of every tab except Settings. Its job changes depending on where the user is:

| Where the user is | What the composer does |
|-------------------|----------------------|
| Inbox, no chat open | Creates a note and adds it to the feed |
| Inbox, inside a chat | Sends a message to that chat |
| Notes tab, browsing list | Creates a note and adds it to the notes list |
| Notes tab, inside a detail | Hidden — note is being read, not composed |

The user never chooses a "type" — the context makes it obvious. The button label and placeholder text confirm what will happen.

---

## The composer lifecycle

### 1. Draft persistence

The composer remembers what the user was typing even if they switch tabs, background the app, or get a phone call. When they return, the text is exactly where they left it — per target context. A draft on the Inbox is separate from a draft on Notes.

The draft is gone the moment the user submits. There is no undo.

### 2. Typing

- Placeholder text describes the action ("What's on your mind?", "New note…", "Message…")
- The text field grows vertically as the user types, up to ~5 lines, then scrolls internally
- The submit button is inactive until there is either text or an attachment

### 3. Attachments

The user can attach up to 5 items. Each attachment:
- Uploads immediately when picked (not held until submit)
- Shows a chip with a filename and a remove button while uploading and after
- Shows a spinner on the chip during upload
- Shows a red error state with a retry button if the upload fails
- Is removed from the composer but not deleted from the server when the user taps ✕

The attachment list sits between the text field and the send button row, not below the keyboard.

If the user dismisses the composer (navigates away, switches target) with uploaded attachments still in the list, those attachments are abandoned — no server cleanup is required but no error is shown either.

### 4. Voice input

Tapping the microphone starts recording. The text field is replaced by a live waveform. Tapping stop transcribes the audio and appends the transcript to the existing draft text, separated by a newline. If transcription fails, a toast explains why; the recording is discarded.

### 5. Submit

Tapping the submit button:

1. The button shows a spinner immediately
2. The draft text and attachment IDs are sent to the API
3. On **success**:
   - The text field clears
   - All attachment chips clear
   - The draft stored on disk is deleted
   - The new item appears in the relevant list (see below)
   - The submit button returns to its inactive state
4. On **failure**:
   - The draft text and attachments remain exactly as they were
   - A brief error toast appears below the composer ("Failed to save — tap to retry")
   - The user can edit and try again

---

## List refresh after submit

This is the core of what must feel instant and reliable.

### Creating a note from the Inbox tab

1. User submits note from the Inbox composer
2. The new note appears at the **top** of the inbox feed immediately — the list does not reload; the item is prepended optimistically
3. The list scrolls to the top so the new item is visible
4. If the API call fails after optimistic insert, the item is removed and an error toast appears

### Creating a note from the Notes tab

1. User submits note from the Notes composer
2. The new note appears at the **top** of the notes list immediately — prepended optimistically
3. The list scrolls to the top
4. Same failure rollback as above

### Sending a chat message

1. User submits message from the Chat composer
2. The message appears at the **bottom** of the message thread immediately — optimistically
3. The reply area shows "thinking…" while the AI is responding
4. The AI response streams in or appears as a block when ready
5. If the send fails, the message shows a red "!" and a retry tap target

### Starting a new chat from the Inbox

1. User taps the secondary action (chat icon / "Start chat" button) in the Inbox composer
2. A new chat is created and the user is navigated into it immediately
3. The message is already sent; it appears in the thread
4. The back button returns to the inbox, which now shows the new chat at the top

---

## The inbox list

### What it shows

The inbox is a unified feed of:
- Notes created by the user (sorted newest first)
- Chat threads (sorted by most recent message)

Each item shows:
- **Note:** first line of content, creation time, attachment count if any
- **Chat:** title or first message preview, time of last message, unread indicator if new AI response

### Loading states

| State | What the user sees |
|-------|--------------------|
| First open, no cached data | Full-screen skeleton shimmer |
| First open, cached data available | Cached list renders instantly; silent background refresh |
| Pull-to-refresh | Spinner at top, list updates when done |
| Background refresh (on tab re-enter after 30s) | Silent — list updates without any visual disruption |
| Empty state (no items ever) | Illustration + "Create your first note" prompt |
| Error (no cached data, network failed) | Illustration + error message + "Retry" button |
| Error (cached data exists, refresh failed) | Cached list stays visible; small banner "Couldn't refresh — pull to retry" |

### Scroll position

The list remembers scroll position between tab switches. It only snaps to the top when:
- The user just created a new item from the composer
- The user taps the tab icon when already on the Inbox tab

### Interaction

- Tapping a note: opens note detail (read-only view with edit button)
- Tapping a chat: navigates into the chat thread and opens the chat composer
- Swipe left on a note: shows Archive and Delete actions
- Swipe left on a chat: shows Archive and Delete actions

---

## The notes list

### What it shows

All notes, newest first. Notes created from either the Notes tab or the Inbox tab appear here.

### Loading states

Same states as the inbox (see above). The notes list has its own independent fetch state.

### Interaction

- Tapping a note: opens note detail
- In detail view: the composer is hidden (you're reading, not composing)
- Edit button in detail view: inline editing, save on dismiss

---

## Gaps between the current implementation and this spec

### Critical (breaks the core loop)

1. **Form does not reset after submit.** Draft text and attachment chips remain after a successful save. The user has no signal that anything happened.

2. **New items don't appear without a manual refresh.** The inbox and notes list each wait up to 30 seconds before fetching again. After submitting, the user is expected to pull-to-refresh to see their own content.

### Significant (degrades experience)

3. **No optimistic insert.** The item should appear immediately in the list before the API call confirms. Instead nothing happens until a refresh.

4. **No error state on submit failure.** If the API call fails, the form clears (or doesn't — see gap 1) with no explanation.

5. **Attachments upload but have no error recovery.** A failed upload shows nothing. The chip stays in a permanent spinner state.

### Minor (polish)

6. **Draft text persists to disk but selected notes and attachments do not.** On a crash mid-compose, only text is restored.

7. **No "thinking…" indicator in the chat thread** while the AI is responding to a freshly submitted message.

---

## Correct behavior summary (checklist)

After a submit succeeds:
- [ ] Text field is empty
- [ ] Attachment chips are gone
- [ ] Submit button is inactive
- [ ] Persisted draft is deleted
- [ ] New item appears at the top of the relevant list
- [ ] List scrolls to reveal the new item

After a submit fails:
- [ ] Text field and attachments are unchanged
- [ ] Error message is shown
- [ ] User can retry without re-typing

On app relaunch mid-draft:
- [ ] Draft text is restored
- [ ] Attachments are NOT restored (acceptable — uploads don't survive relaunch)
