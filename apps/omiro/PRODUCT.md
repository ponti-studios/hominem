# Omiro — Product Feature Inventory

**Version:** 0.1 (as of 2026-06-19)  
**Platform:** iOS (React Native / Expo)  
**Codename:** Hakumi  

---

## 1. Product Overview

Omiro is an AI-powered personal capture and conversation assistant for iOS. The app provides a unified workspace where users can quickly create notes, hold multi-turn conversations with an AI, attach files, and use voice to capture thoughts. The design philosophy emphasizes frictionless capture, on-device privacy, and simplicity — a single inbox that surfaces everything.

**Core Value Propositions:**
- Zero-friction note capture with a bottom-sheet composer always accessible
- AI conversation that persists context and can reference saved notes
- Voice-first input with on-device transcription (no third-party service required)
- One unified inbox for all artifacts (notes and chats)
- Privacy controls built into the app (Face ID lock, screenshot prevention)

---

## 2. Authentication & Account

### 2.1 Email OTP Sign-In

**User flow:**
1. User enters email address on the landing screen
2. A "Continue" button animates in once the email passes validation
3. Server sends a 6-digit one-time passcode with a 5-minute expiry
4. User enters the code on the verification screen
5. A session cookie is issued and persisted to secure storage
6. On success: animated checkmark, redirect to onboarding (if new user) or workspace home

**Details:**
- Real-time email format validation before allowing submission
- Email is normalized (lowercased, trimmed) before sending
- The verification screen shows a live countdown timer color-coded by urgency (red < 20s, orange < 60s)
- "Change email" link returns the user to the email entry screen
- "Resend code" is available after the timer expires, with server-side rate limiting
- Deep link support: magic link (`hakumi://verify?email=x&token=y`) auto-submits the OTP
- Auth errors produce a haptic shake animation on the input field

### 2.2 Passkey Sign-In (Feature-Flagged)

- Users can register a passkey via Settings → Passkeys
- Sign-in can be initiated from the auth screen using biometric (Face ID / Touch ID)
- Multiple passkeys can be registered, each with a display name
- Any passkey can be removed from Settings with a confirmation step
- Falls back gracefully when passkeys are not available on the device

### 2.3 Authentication State Machine

| State | Meaning |
|---|---|
| `booting` | App is checking for an existing session cookie |
| `signed_out` | No valid session found |
| `otp_requested` | OTP email sent, waiting for code entry |
| `verifying_otp` | Code submitted, waiting for server confirmation |
| `signing_in` | Session being created |
| `signed_in` | Valid session active |
| `signing_out` | Logout in progress |
| `degraded` | Session detected but invalid or expired |

Session cookies are stored in `expo-secure-store`. Receiving a 401 from the API automatically triggers logout.

### 2.4 Onboarding

- Triggered once, immediately after first sign-in, if the user has no display name
- Simple single-field form for display name
- Options: "Start" (save name), "Continue without name", "Sign out"
- On completion (or skip), user is redirected to the workspace home

### 2.5 Account Management

- Display name can be edited in-line in Settings with an inline save button and confirmation message
- Email is displayed as read-only (cannot be changed in-app)
- Sign out requires confirmation and clears local session data
- Account deletion is present in the UI (Danger Zone) but disabled in the current release ("not available in this release")

---

## 3. Workspace Home (Unified Inbox)

### 3.1 Inbox Stream

The home screen is a vertically scrollable, infinitely paginated feed that interleaves all user content — notes and chats — ordered by last activity.

- **Pagination:** Cursor-based, 50 items per page, auto-loads next page on scroll
- **Virtualization:** Powered by `@shopify/flash-list` for high-performance rendering
- **Item types:** Notes and chats are visually differentiated by kind icon
- **Item card:** Shows title (or "Untitled"), a preview snippet, and a relative timestamp
- **Pull-to-refresh:** Manual data refetch with a standard spinner
- **Search bar:** Fixed at the top; filters the visible list in real time by title or preview text
- **Skeleton loader:** Shown on first load before data arrives
- **Error state:** Full-screen error UI with a retry button

### 3.2 Swipe Gestures on Inbox Items

- **Notes:** Swipe left to delete (with confirmation alert)
- **Chats:** Swipe left to archive (moves to archived chats, not deleted)
- Swipe gesture has a visual affordance (colored background action area)

### 3.3 Composer

A bottom-anchored multi-mode input that stays attached to the keyboard.

#### 3.3.1 Save Note Mode (Feed)

- Typing in the composer and tapping the send button creates a standalone note
- The note is immediately added to the top of the inbox feed (optimistic update)
- Attachments can be added before submitting

#### 3.3.2 Start Chat Mode (Feed)

- A "Start Chat" button in the composer toolbar switches to chat mode
- Submitting in this mode creates a new chat session and navigates to the Chat Detail Screen
- The first message is immediately sent to the AI

#### 3.3.3 Composer Toolbar Buttons

| Button | Action |
|---|---|
| Attach | Opens file picker (camera, photo library, document) |
| Voice | Starts voice recording for transcription |
| Enhance | Opens AI text enhancement tray |
| Start Chat / Send | Context-dependent submit |

---

## 4. Note-Taking

### 4.1 Note Creation

- Notes are created from the workspace home composer or by saving from a chat
- Notes can have a title, body content (markdown), and file attachments
- Titles are optional; untitled notes display a "Untitled" placeholder in the inbox

### 4.2 Note Editor

Accessed by tapping any note in the inbox. Full-screen editor with:

- **Native title input** (SwiftUI-powered) at the top for crisp performance
- **Markdown body editor** with multi-line text support
- **Metadata row** showing created/updated dates
- **File attachment section** at the bottom (inline display of attached files)
- **Auto-save:** Debounced at 600ms — every keystroke schedules a save that fires 600ms after the user stops typing. The final save is also flushed on unmount.

### 4.3 Markdown Formatting Toolbar

A persistent `inputAccessoryView` displayed above the iOS keyboard whenever the note body is focused.

**Text formatting:**
- Bold
- Italic
- Strikethrough
- Inline code

**Block elements:**
- Heading toggle (cycles through heading levels)
- Block quote
- Checklist (task list)
- Bullet list
- Numbered list

**Navigation:**
- Increase indent
- Decrease indent

**History:**
- Undo
- Redo

### 4.4 AI Text Enhancement (Inline)

Accessible via the "Enhance" button in both the note toolbar and the composer toolbar.

**Preset suggestion chips:**
- Fix grammar
- Make concise
- Make formal
- Expand ideas
- Simplify language
- Add bullet points

**Custom instruction input:** Free-text field for any other instruction.

The AI streams an improved version of the selected (or full) text. The user can accept or cancel. On acceptance, the enhanced text replaces the original in the editor.

### 4.5 File Attachments (Notes)

- Files attached to a note are displayed inline in the editor view
- Tapping a file shows metadata (type, size, transcription if audio)
- Files can be detached (removed from the note) with a single tap and confirmation prompt
- Attachment uploads happen asynchronously; the server processes them (OCR, transcription, content extraction)

### 4.6 Note Deletion

- Swipe-to-delete from the inbox (with a confirmation alert)
- No explicit delete button inside the note editor in the current build

---

## 5. AI Conversations (Chat)

### 5.1 Chat Creation

- Initiated from the workspace home composer (Start Chat mode)
- A new chat session is created on the server, and the app navigates to the Chat Detail Screen
- The first user message is sent immediately

### 5.2 Chat Detail Screen

Full-screen conversation interface.

**Message list:**
- All messages displayed in chronological order (user messages right-aligned, assistant left-aligned)
- Markdown rendering for AI responses
- Date/time stamps on messages
- Referenced notes displayed inline below the AI message (with note title and excerpt)

**AI response states:**
- "Thinking" indicator animation during AI processing
- Streaming text: assistant text streams in word by word in real time
- Tool call visualization: when the AI invokes a tool (e.g., saves a note), the action is shown as a card

**Composer (chat mode):**
- Same composer as feed but wired for follow-up messages in the current chat
- Attachments and voice input supported

### 5.3 Message-Level Actions

Long-press (or tap the action area) on any message to access:

| Action | Availability |
|---|---|
| Copy | All messages |
| Share | All messages (iOS share sheet) |
| Edit | User messages only |
| Regenerate | Last assistant message |
| Delete | All messages (with confirmation) |
| View reasoning | Assistant messages with extended thinking |
| Debug metadata | Dev mode only |

### 5.4 Conversation-Level Actions

A menu accessible from the header provides:

- Search messages (opens message search modal)
- Transform chat → note
- Transform chat → task
- Transform chat → task list
- Archive chat
- Toggle debug mode (dev only)
- Refresh messages

### 5.5 Message Search

A modal that provides:
- Full-text search across all messages in the current conversation
- Result count display
- Scroll-to-result on tap

### 5.6 Chat-to-Artifact Transformation

The AI can propose turning a conversation into a structured artifact (note, task, task list, tracker).

**User review flow:**
1. AI generates a classification proposal containing: artifact type, suggested title, and a content preview
2. A `ClassificationReview` overlay appears with the proposal
3. User taps **Accept**: artifact is saved, optimistic update shown
4. User taps **Reject**: proposal is discarded, conversation continues

### 5.7 Chat Archiving

- Archived chats are removed from the main inbox
- Accessible via Settings → Archived Chats
- Archived chats can be "unarchived" by tapping them in the archived list (navigates back to the chat, which implicitly restores it)
- The archived list has pull-to-refresh and an empty state

### 5.8 AI Capabilities

| Capability | Description |
|---|---|
| Multi-turn context | Conversation history is sent on each request |
| Note referencing | AI can search and cite user notes in responses |
| Extended thinking | Reasoning chain displayed (read-only) when available |
| Tool use | AI can take actions (save note, look up items) with visible tool cards |
| Streaming | Responses are streamed token-by-token via SSE |

---

## 6. Voice Input

### 6.1 Recording Flow

1. User taps the microphone button in the composer toolbar
2. App requests microphone permission (with graceful fallback prompt if denied)
3. Recording begins; a visual indicator shows active recording
4. Tapping again stops recording
5. Audio is transcribed on-device using Apple's Speech Recognition framework
6. Transcribed text is inserted into the composer draft

### 6.2 Voice Processing Pipeline

1. Record audio (local temp file)
2. Transcribe (on-device, Apple Speech)
3. Insert raw transcription into draft text field
4. Background AI cleanup (grammar/clarity) if enabled
5. Replace draft with cleaned text if cleanup succeeds
6. Delete temp audio file

### 6.3 Error Handling

- Transcription failure shows an in-app error message without losing other draft content
- Permission denial surfaces a user-friendly prompt to enable microphone in Settings
- Partial recordings are discarded cleanly

---

## 7. File Attachments (Media)

### 7.1 Input Sources

| Source | Trigger |
|---|---|
| Camera (photo) | Opens native camera; saves to camera roll on capture (with confirmation) |
| Photo library | Opens native image picker to browse and select |
| Document picker | iOS document browser for any file type |

### 7.2 Upload Flow

1. File is selected via the appropriate picker
2. Upload begins immediately; a progress bar is shown in the attachment row within the composer
3. On completion, the file is shown as a thumbnail or document icon
4. Multiple attachments are displayed in a horizontal scroll row above the text input
5. Any attachment can be removed before submitting

### 7.3 Server-Side Processing

The server performs async processing after upload:
- **Images:** OCR for extractable text
- **Audio:** Transcription
- **Documents:** Text content extraction
- **All types:** Metadata extraction (size, MIME type, duration for audio/video)

### 7.4 Attachment Display (Notes)

Accepted files are displayed in the note editor. Each attachment shows:
- File type icon
- File name and size
- Transcription text (for audio files)
- Detach (remove) button

---

## 8. Search & Discovery

### 8.1 Inbox Search

- Search bar pinned to the top of the workspace home screen
- Filters the current inbox list in real time as the user types
- Matches against title and preview text
- No explicit "search results" screen — filtering happens inline

### 8.2 Conversation Search

- Accessible from the chat detail header menu ("Search messages")
- Opens a modal search interface
- Full-text matches across all messages in the current chat
- Tapping a result scrolls the message list to that message

---

## 9. Privacy & Security

### 9.1 Face ID App Lock

- Toggle in Settings → Privacy
- When enabled, the app requires biometric authentication (Face ID, or passcode fallback) each time the app is resumed from the background
- Setting is stored in MMKV (survives app restarts)

### 9.2 Screenshot & Screen Recording Prevention

- Toggle in Settings → Privacy
- When enabled, sets a hardware-level flag that blocks the iOS screen capture API
- Prevents third-party screen recorders and AirPlay screen mirroring from capturing app contents
- Setting is stored in MMKV

### 9.3 On-Device Voice Transcription

- Uses Apple's on-device Speech Recognition (no audio sent to third-party servers)
- Audio temp files are deleted after transcription

### 9.4 Secure Session Storage

- Session cookie stored in `expo-secure-store` (iOS Keychain-backed)
- Automatic logout on 401 API response (invalid/expired session)
- Passkey credentials managed by the iOS system credential provider

---

## 10. Settings

### 10.1 Account Section

| Setting | Behavior |
|---|---|
| Display Name | Editable inline; shows save confirmation; validates non-empty |
| Email | Read-only display |

### 10.2 Privacy Section

| Setting | Behavior |
|---|---|
| Lock with Face ID | Toggles biometric app lock on resume |
| Prevent Screenshots | Toggles hardware screen-capture flag |

### 10.3 Chats Section

| Setting | Behavior |
|---|---|
| Archived Chats | Navigates to the archived chats list screen |

### 10.4 Passkeys Section (Feature-Flagged)

| Setting | Behavior |
|---|---|
| Add Passkey | Triggers native WebAuthn registration flow |
| Passkey list | Displays name and creation date for each registered passkey |
| Remove Passkey | Removes passkey with confirmation, with error handling |

### 10.5 Danger Zone

| Setting | Behavior |
|---|---|
| Sign Out | Confirmation alert, then clears session and returns to auth screen |
| Delete Account | Shows "not available in this release" message |

---

## 11. Navigation & Deep Links

### 11.1 Route Structure

```
Root
├── /(auth)
│   ├── /                     Email entry
│   └── /verify               OTP verification
└── /(protected)
    ├── /                     Workspace home (inbox)
    ├── /onboarding           First-time profile setup
    ├── /inbox/[kind]/[id]    Note or chat detail (kind = "note" | "chat")
    └── /settings
        ├── /                 Settings home
        └── /archived-chats   Archived conversations list
```

### 11.2 Deep Links

| URL | Destination |
|---|---|
| `hakumi://inbox/chat/[id]` | Opens a specific chat |
| `hakumi://inbox/note/[id]` | Opens a specific note |
| `hakumi://verify?email=x&token=y` | Auto-submits OTP verification |

### 11.3 State Restoration

On app launch, the app restores context:
- If a chat was last active, it navigates to that chat
- If a note was last being edited, it navigates to that note
- Draft text in the composer is preserved across navigation

---

## 12. Performance & Technical Architecture

### 12.1 Data Flow

```
User Action
    │
    ▼
React Query Mutation (optimistic update)
    │
    ├─▶ Local cache updated immediately (fast UI)
    │
    ▼
API Request (via @hominem/rpc client)
    │
    ├─▶ On success: cache reconciled with server response
    └─▶ On failure: optimistic update rolled back, error shown
```

### 12.2 Local Persistence (MMKV)

| Key | Data |
|---|---|
| Inbox items | Serialized last-known inbox state |
| Chat messages | Per-chat message cache |
| Notes | Per-note content cache |
| User preferences | Face ID toggle, screenshot toggle |
| Session cookie | Auth credential |
| Composer draft | In-progress text |

### 12.3 Streaming (SSE)

Chat responses use Server-Sent Events:
- A new message placeholder is written to cache before the stream begins
- Incoming chunks are buffered and flushed to the UI every ~32ms to prevent excessive re-renders
- On stream complete, the final message state is written to the query cache

### 12.4 Key Libraries

| Library | Role |
|---|---|
| `expo` v56 | Framework |
| `react` v19 | UI runtime |
| `@tanstack/react-query` v5 | Server state & caching |
| `react-native-mmkv` v4 | Fast local storage |
| `better-auth` v1.6 | Auth client |
| `react-native-reanimated` v4 | Gesture & animation |
| `@shopify/flash-list` v2 | Virtualized list |
| `@gorhom/bottom-sheet` v5 | Modal sheets |
| `expo-router` v56 | File-based navigation |
| `expo-local-authentication` | Face ID / biometrics |
| `expo-audio` | Voice recording |
| Custom `voice-transcriber` | On-device iOS transcription |
| `posthog-react-native` | Product analytics |
| `zod` v4 | Schema validation |

---

## 13. Analytics

- **PostHog** is integrated for product analytics (opt-in / feature-flagged)
- Events can be fired for key user actions
- Feature flag support via PostHog for controlled rollouts

---

## 14. Not Yet Implemented (Known Gaps)

The following features have infrastructure or partial code present but are not exposed to users in the current release:

| Feature | Status |
|---|---|
| Account deletion | UI placeholder exists; backend not wired |
| Note publishing/sharing | Data model supports it; no UI |
| Dark theme | Architecture supports it; only light mode built |
| Tags & collections | Present in data model; no UI |
| Mentions / people linking | Present in data model; no UI |
| Scheduled notes | `scheduledFor` field in schema; no UI |
| Offline sync queue | Read cache exists; no write queue for offline creates |
| Multi-select attachments | Picker supports single file only |
| Collaborative editing | No multi-user awareness |
| Custom AI personality | Generic assistant; no per-user tuning |
| Extended thinking controls | Reasoning is displayed but depth cannot be configured |
| Full-text search on file contents | Server extracts content but search doesn't index it |
| Note versioning UI | Version number tracked; no history browser |

---

## 15. Accessibility

- `testID` props on interactive elements for E2E testing
- `accessibilityLabel` on icon-only buttons
- Live region announcements for async error states
- Standard iOS focus management (keyboard avoidance, safe area insets)
- Haptic feedback on key interactions

---

*Document generated from codebase analysis of `apps/omiro` on 2026-06-19.*
