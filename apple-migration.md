# Expo → SwiftUI Migration Plan

## Key Insight: You're Ahead of Schedule

The `apps/apple/` directory already has a significant SwiftUI foundation:

- `APIClient.swift` with `CookieJar` and `KeychainSessionStore`
- Full auth flows: email OTP + passkeys (both iOS + macOS)
- `AppModel.swift` as the central state container
- `AuthState` reducer (pure, fully tested)
- XCTest suite covering auth, cookie logic, and API client
- `project.yml` configured for `HominemAppleiOS` + `HominemAppleMac` (macOS native)

This is extension work, not a rewrite.

---

## Phase 1: Project Setup ✅ (Already Done)

The Xcode project is configured via `apps/apple/project.yml` with:

- `HominemAppleiOS` iOS target (min iOS 17)
- `HominemAppleMac` macOS target (min macOS 14, Apple Silicon)
- `HominemAppleiOSTests` + `HominemAppleMacCoreTests` hosted unit-test bundles
- `HominemAppleMacE2E` UI test target
- `HominemAppleCore` Swift package in `Sources/`

---

## Phase 2: Authentication ✅ (Already Done)

Already implemented:

- `AuthService.swift` — sendOTP, verifyOTP, signOut, getSession, fetchLatestTestOTP
- `PasskeyProvider.swift` — register + authenticate via `ASAuthorizationController`
- `SignedOutView.swift` — email entry + OTP verification inline
- `SystemPasskeyProvider` handles both iOS (`UIWindowScene`) and macOS (`NSWindow`)
- `AppModel` drives full auth state machine with `AuthState` reducer

---

## Phase 3: API Client — Service Actors ✅

All four service layers built with full unit-test coverage.

### 3.1 NotesService ✅
File: `Sources/HominemAppleCore/Services/NotesService.swift`

- `POST /api/notes` → `createNote(input:)`
- `GET /api/notes` → `listNotes(query:)` with `NotesListQuery` → `[URLQueryItem]`
- `GET /api/notes/:id` → `getNote(id:)`
- `PATCH /api/notes/:id` → `updateNote(id:input:)` (custom `encode(to:)` for null clearing)
- `DELETE /api/notes/:id` → `deleteNote(id:)`
- `POST /api/notes/:id/archive` → `archiveNote(id:)`
- `POST /api/notes/classify` → `classifyNote(content:)`
- `POST /api/review/accept` → `acceptReview(reviewId:)`

Tests: `Tests/HominemAppleCoreTests/NotesServiceTests.swift` (9 tests, custom `URLProtocol` with `httpBodyStream` reading)

### 3.2 ChatsService ✅
File: `Sources/HominemAppleCore/Services/ChatsService.swift`

- `GET /api/chats` → `listChats(limit:)`
- `GET /api/chats/:id` → `getChat(id:)`
- `POST /api/chats` → `createChat(input:)`
- `PATCH /api/chats/:id` → `updateChat(id:title:)`
- `POST /api/chats/:id/archive` → `archiveChat(id:)`
- `GET /api/chats/:id/messages` → `getMessages(chatId:limit:offset:)`
- `POST /api/chats/:id/messages` → `sendMessage(chatId:message:fileIds:noteIds:)`

Tests: `Tests/HominemAppleCoreTests/ChatsServiceTests.swift` (6 tests)

### 3.3 FilesService ✅
File: `Sources/HominemAppleCore/Services/FilesService.swift`

- `POST /api/files/prepare-upload` → `prepareUpload(...)`
- `PUT <presignedS3URL>` → `uploadToS3(url:data:mimeType:)` (no auth cookies)
- `POST /api/files/complete-upload` → `completeUpload(fileId:)`
- `DELETE /api/files/:id` → `deleteFile(id:)`
- Convenience: `upload(data:originalName:mimeType:)` runs all three steps

### 3.4 VoiceService ✅
File: `Sources/HominemAppleCore/Services/VoiceService.swift`

- `POST /api/voice/speech` → `textToSpeech(text:voice:speed:) → Data`
- `POST /api/voice/transcribe` → `transcribe(audioURL:mimeType:) → String` (multipart/form-data)

APIClient extensions: `patch(_:path:body:)`, `postForData(path:body:)`, `upload(to:data:mimeType:)`, `postMultipart(_:path:fileURL:mimeType:fieldName:)`

---

## Phase 4: Core Screens Migration ✅

All screens built and wired into the navigation shell.

| Expo Route | SwiftUI View | Status |
|---|---|---|
| `(tabs)/_layout.tsx` | `ContentView` (TabView / NavigationSplitView) | ✅ |
| `(tabs)/index.tsx` | `FeedView` | ✅ |
| `(tabs)/notes/page.tsx` | `NotesListView` | ✅ |
| `(tabs)/notes/[id].tsx` | `NoteDetailView` | ✅ |
| `(tabs)/sherpa/` | `ChatsListView` + `ChatThreadView` | ✅ |
| `(tabs)/settings/` | `SettingsView` | ✅ |
| `(auth)/index.tsx` | `SignedOutView` | ✅ |

### Key implementation details:

- **ContentView** — iOS: `TabView` (Feed/Notes/Chat/Settings); macOS: `NavigationSplitView` with `MacSidebarSelection` binding driving the detail pane
- **FeedView** — Mixed `FeedItem` list (notes + chats sorted by `updatedAt`), pull-to-refresh, `ContentUnavailableView`, kind badge icons
- **NotesListView** — `searchable`, filter chips (`FilterChip` per `NoteContentType`), `NavigationLink` → `NoteDetailView`, new-note sheet, `⌘N` notification listener
- **NoteDetailView** — `TextField` title + `TextEditor` content, 1.5s debounce auto-save via `Task.sleep`, `SaveState` toolbar indicator, `FileAttachmentRow` with `AsyncImage`
- **ChatThreadView** — `ScrollViewReader` message list, `MessageBubble` with TTS speak button, `TypingIndicator`, `ComposerView` integration, optional `TTSPlayer`
- **ChatsListView** — `NavigationLink` rows → `ChatThreadView`, new-chat sheet, `⌘N` notification listener, passes `voiceService` + `ttsPlayer` through
- **SettingsView** — Account info, passkey management (`PasskeyRow`), app-lock toggle, error section, sign-out button. Replaces old `AccountView`.

---

## Phase 5: State Management ✅

All `@Observable @MainActor` stores built and wired into `AppModel`.

### NotesStore ✅
File: `Sources/HominemAppleCore/Stores/NotesStore.swift`

- `notes: [Note]`, `isLoading`, `error`
- `refresh(query:)`, `createNote(_:)`, `updateNote(id:input:)`, `deleteNote(id:)` (optimistic with rollback), `archiveNote(id:)`, `note(id:)` local lookup

### ChatsStore ✅
File: `Sources/HominemAppleCore/Stores/ChatsStore.swift`

- `chats`, `activeThread`, `activeChatId`, `isLoading`, `isSending`
- `refresh()`, `createChat(title:)`, `loadThread(chatId:)`, `clearThread()`, `sendMessage(chatId:message:)`

### FeedViewModel ✅
File: `Sources/HominemAppleCore/Stores/FeedViewModel.swift`

- `FeedItem` enum (`.note(Note)` / `.chat(Chat)`), `relativeDate` via `RelativeDateTimeFormatter`
- `rebuild()` merges both stores sorted by `updatedAt` desc; `refresh()` fetches both then rebuilds

### AppModel wiring ✅
- `notesStore`, `chatsStore`, `feedViewModel` as public `let` properties
- `live()` factory creates all stores from shared `APIClient`
- `signOut()` clears store errors and stops TTS

---

## Phase 6: Native Features ✅

### 6.1 ComposerView ✅
File: `Sources/HominemAppleCore/UI/ComposerView.swift`

- Multi-line `TextField` with `lineLimit(1...6)`
- `PhotosPicker` for image attachment (iOS)
- Mic button toggling `AudioRecorder` start/stop + transcription
- Animated `audioStatusBar` (recording/transcribing/failed states)
- macOS drag-drop: `.dropDestination(for: String.self)` on text field with highlight
- Send button with `canSend` state

### 6.2 Camera / Image Picker ✅
Integrated into `ComposerView` via `PhotosPicker` (SwiftUI native, replaces `expo-image-picker`).

### 6.3 Audio Recording + Transcription ✅
File: `Sources/HominemAppleCore/Audio/AudioRecorder.swift`

- `AudioRecorderState`: `.idle` → `.requestingPermission` → `.recording` → `.stopping` → `.transcribing` → `.idle`
- Protocol `AudioPermissionChecker` — `LiveAudioPermissionChecker` (iOS: `AVAudioApplication.requestRecordPermission()`, macOS: `AVCaptureDevice.requestAccess`)
- Protocol `AudioRecordingEngine` — `LiveAudioRecordingEngine` (`AVAudioRecorder` writing to temp `.m4a`)
- `@Observable @MainActor AudioRecorder` — `startRecording()`, `stopAndTranscribe(using:)`, `cancel()`, `clearError()`
- Tests: `Tests/HominemAppleCoreTests/AudioRecorderTests.swift` (8 tests with `StubPermissionChecker` + `StubRecordingEngine`)

### 6.4 TTS Playback ✅
File: `Sources/HominemAppleCore/Audio/TTSPlayer.swift`

- `@Observable @MainActor TTSPlayer` backed by `AVAudioPlayer`
- `NSCache` keyed by `"voice|speed|text"` — repeated phrases never hit network
- `speak(_:voice:speed:)`, `stop()`, `toggle(_:)`, `clearCache()`
- `AVAudioPlayerDelegate` with Swift 6-safe `ObjectIdentifier` pattern
- Wired into `MessageBubble` — assistant messages get a speak/stop button

### 6.5 SQLite Local Cache 🔲 TODO
Requires adding `GRDB.swift` to `Package.swift`. Tables: notes, chats, chat_messages.
Cache strategy: fetch from API, write to DB, serve from DB on next launch.

### 6.6 Background Sync 🔲 TODO
- iOS: `BGAppRefreshTask` registered in `Info.plist`
- macOS: `NSBackgroundActivityScheduler`
- Syncs notes + chats in background

### 6.7 App Lock ✅
File: `Sources/HominemAppleCore/Auth/AppLockService.swift`

- `AppLockState`: `.unavailable` / `.unlocked` / `.locked` / `.authenticating` / `.failed(String)`
- `LAContext.evaluatePolicy(.deviceOwnerAuthentication)` for Face ID / Touch ID / passcode
- `UserDefaults` persistence under `appLock.enabled`
- `engageLockIfNeeded()` called on foreground notification
- Toggle in `SettingsView` under "SECURITY" section
- `AppLockOverlay` view shows lock screen with unlock button
- Wired into `ContentView` overlay + foreground notification

---

## Phase 7: macOS Adaptations ✅

| Feature | Status | Implementation |
|---|---|---|
| Navigation | ✅ | `NavigationSplitView` with `MacSidebarSelection` enum driving detail pane |
| Keyboard shortcuts | ✅ | `⌘,` → Settings, `⌘N` → context-aware new note/chat (`MacKeyboardShortcuts` modifier) |
| Toolbar | ✅ | `.toolbar` with `ToolbarItem(placement: .primaryAction)` on all list views |
| File drag-drop | ✅ | `.dropDestination(for: String.self)` on `ComposerView` text field |
| Window size | ✅ | Already in `RootView.swift` |
| Passkeys | ✅ | `SystemPasskeyProvider` has `#if canImport(AppKit)` branch |
| Screen sharing | 🔲 TODO | `NSWindow.sharingType = .none` |

---

## Phase 8: Testing Strategy ✅ (Mostly Done)

### Existing test coverage (36 tests passing):

| Test File | Covers |
|---|---|
| `AuthServiceTests.swift` | Auth API calls, OTP flow, passkey endpoints |
| `AuthStateTests.swift` | Auth state reducer transitions |
| `CookieJarTests.swift` | Cookie persistence and session management |
| `AppEnvironmentTests.swift` | Environment resolution, config files |
| `NotesServiceTests.swift` | All CRUD + classify + archive (9 tests) |
| `ChatsServiceTests.swift` | List, create, send, update, archive (6 tests) |
| `AudioRecorderTests.swift` | State machine transitions, permissions, errors (8 tests) |

### Test infrastructure:

- `HominemAppleiOSTests` — hosted `bundle.unit-test` inside iOS app on simulator (`TEST_HOST`/`BUNDLE_LOADER`)
- `HominemAppleMacCoreTests` — hosted `bundle.unit-test` inside macOS app (`TEST_HOST`/`BUNDLE_LOADER`)
- `HominemAppleMacE2E` — UI test bundle, email OTP sign-in + sign-out flow against live local API
- Both test targets share `Tests/HominemAppleCoreTests/` sources
- `Makefile` with `make test-ios`, `make test-macos`, `make test-e2e`, `make test-all`

### E2E test config:
- API `.env` needs: `AUTH_TEST_OTP_ENABLED=true`, `AUTH_E2E_ENABLED=true`, `AUTH_E2E_SECRET=otp-secret`
- `Config/Configurations/Debug.xcconfig` needs: `HOMINEM_AUTH_TEST_SECRET=otp-secret`
- E2E test uses `HOMINEM_E2E_MODE=1` launch environment

### Remaining test work 🔲:
- `FeedViewModelTests.swift` — merge-sort of notes + chats by date
- `NoteDetailViewModelTests.swift` — debounce cancel, optimistic update
- E2E expansion — note creation, chat send, settings navigation
- Snapshot tests for key views

---

## Sprint Progress

| Sprint | Phases | Status |
|---|---|---|
| Sprint 1 | Phase 3 — 4 service actors + unit tests | ✅ Complete |
| Sprint 2 | Phase 5 — Stores + Phase 4 — FeedView, NotesListView | ✅ Complete |
| Sprint 3 | Phase 4 — NoteDetailView, ChatThreadView | ✅ Complete |
| Sprint 4 | Phase 6 — ComposerView, Photos, AudioRecorder | ✅ Complete |
| Sprint 5 | Phase 6 — TTS, App Lock + Phase 7 — macOS adaptations | ✅ Complete |
| Sprint 6 | Phase 4 — SettingsView + Phase 7 — sidebar wiring, keyboard shortcuts | ✅ Complete |
| Sprint 7 | Remaining items | 🔲 In Progress |

---

## Remaining Work (Sprint 7)

### High priority
1. **SQLite local cache** (Phase 6.5) — Add `GRDB.swift` to `Package.swift`, create `LocalDatabase` actor with tables for notes, chats, chat_messages. Cache-first reads with background API sync.
2. **Background sync** (Phase 6.6) — iOS `BGAppRefreshTask` + macOS `NSBackgroundActivityScheduler` to sync notes/chats while backgrounded.
3. **E2E test verification** — Re-run macOS E2E test with corrected `AUTH_TEST_OTP_ENABLED` + `HOMINEM_AUTH_TEST_SECRET` config.

### Medium priority
4. **Additional unit tests** — `FeedViewModelTests`, `NoteDetailViewModelTests` (debounce behavior)
5. **SSE streaming for chat** — `ChatThreadView` currently uses request/response; add `URLSession` byte-stream for real-time AI responses
6. **Screen sharing protection** (macOS) — `NSWindow.sharingType = .none`

### Nice to have
7. **E2E expansion** — Note creation flow, chat send flow, settings navigation
8. **Snapshot tests** — Key views via `swift-snapshot-testing`
9. **OnboardingView** — First-launch value proposition before email entry
10. **@mention detection** in `ComposerView` — Note linking from chat

---

## Files Created/Modified

### New files (this migration):
```
Sources/HominemAppleCore/
  Models/
    NoteModels.swift
    ChatModels.swift
    FileModels.swift
  Services/
    NotesService.swift
    ChatsService.swift
    FilesService.swift
    VoiceService.swift
  Stores/
    NotesStore.swift
    ChatsStore.swift
    FeedViewModel.swift
  Audio/
    AudioRecorder.swift
    TTSPlayer.swift
  Auth/
    AppLockService.swift
  UI/
    ContentView.swift
    FeedView.swift
    NotesListView.swift
    NoteDetailView.swift
    ChatsListView.swift
    ChatThreadView.swift
    ComposerView.swift
    SettingsView.swift
    MacKeyboardShortcuts.swift

Tests/HominemAppleCoreTests/
  NotesServiceTests.swift
  ChatsServiceTests.swift
  AudioRecorderTests.swift

Makefile
```

### Modified files:
```
Sources/HominemAppleCore/
  AppModel.swift          — Added stores, appLock, ttsPlayer, voiceService
  API/APIClient.swift     — Added patch, postForData, upload, postMultipart
  UI/RootView.swift       — Routes to ContentView instead of AccountView

project.yml              — Added iOS/macOS test targets with TEST_HOST
```

---

## TypeScript → Swift Type Mapping

| TypeScript (`notes.types.ts`, `chat.types.ts`) | Swift |
|---|---|
| `Note` | `struct Note: Codable, Identifiable` |
| `Chat` | `struct Chat: Codable, Identifiable` |
| `ChatMessageDto` | `struct ChatMessage: Codable, Identifiable` |
| `NoteFile` | `struct NoteFile: Codable` |
| `CreateNoteInput` | `struct NotesCreateInput: Encodable` |
| `UpdateNoteInput` | `struct NotesUpdateInput: Encodable` (custom `encode(to:)` for null clearing) |
| `FilePrepareUploadInput/Output` | `struct FilePrepareUploadInput/Output: Codable` |
| `AuthUser`, `RegisteredPasskey` | Already in `AuthModels.swift` ✅ |
