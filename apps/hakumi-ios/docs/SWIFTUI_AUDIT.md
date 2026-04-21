# SwiftUI Audit — Hakumi iOS

**Date:** 2026-04-20  
**Auditor:** Staff-level SwiftUI architecture review  
**Scope:** All SwiftUI views, design system components, navigation, state management, services accessed from views

---

## Executive Summary

The architecture instincts are good. `Router`, `QueryStore`, `ProtectedRoute`, and the design token system are solid choices. `@Observable` is adopted correctly and consistently. The service layer is coherent everywhere except one screen. The problems cluster in three buckets:

**Real bugs shipping now.** The `NoteDetailScreen` chat handoff is broken (note ID used as chat ID). The `ChatScreen` alert binding traps users in a dismiss loop. The voice permission banner cannot be dismissed. These need to be fixed before the next release.

**Duplication that will compound.** Three near-identical list screens, four independent `DateFormatter` implementations with divergent output, and ~20 inline `RoundedRectangle` assemblies despite a `Surface` component existing. Each new feature adds to the pile.

**The singleton wall.** Until `AppStores` and `ComposerState` are environment-injected, previews make real network calls, tests are impossible, and `@Observable`'s benefits are partially negated. This is one afternoon of work with immediate payoff.

None of this requires an architecture overhaul. The current structure is appropriate for the app's scope. The fixes are targeted and incremental.

**Overall score: 5/10**

---

## Scorecard

| Category | Score | Notes |
|---|---|---|
| SwiftUI idiomatic usage | 6/10 | Modern APIs used well; `.constant()` alert bug is a notable exception |
| State management | 5/10 | `@Observable` correct; singleton injection blocks observation correctness |
| Architecture boundaries | 5/10 | Good service layer; one screen does raw networking; composer reaches into stores |
| Performance hygiene | 5/10 | `DateFormatter` per-cell; unthrottled filter recomputation; potential broken observation |
| Accessibility | 4/10 | Missing row labels; non-dismissible banner; forced scroll; no-op button |
| Maintainability | 5/10 | Good naming and comments; three list screens are near-identical |
| Design system consistency | 7/10 | Excellent token coverage; `Surface` underused; chat screen bypasses typography |
| Testability | 3/10 | Singletons everywhere; previews hit real network; no mock data path |

---

## Refactor Priorities

### Priority 1 — Fix immediately (user-visible bugs)

1. Fix `ChatScreen` `.constant(sendError != nil)` alert binding — users get trapped in a dismiss loop
2. Fix voice permission banner dismiss button (empty `{ }` action)
3. Fix `NoteDetailScreen` chat handoff — note ID used as chat ID, navigates to a broken screen
4. Cache `AppLock.isEnabled` in memory — eliminates Keychain read on every SwiftUI render

### Priority 2 — Fix soon (correctness + duplication)

5. Extract `ArchivedChatsScreen.load()` into `ChatService`
6. Consolidate archive/delete/rollback logic into `AppStores`; fix rollback-at-index-0 bug
7. Consolidate four `Date` relative-formatting extensions into one shared file
8. Fix `ComposerState.shared` access pattern in `SharedComposerCard` (broken `@Observable` tracking)
9. Add `ComposerState.reset()` and call it on sign-out

### Priority 3 — Cleanup (architecture health)

10. Inject `AppStores` via SwiftUI `.environment()`
11. Inject `ComposerState` via SwiftUI `.environment()`
12. Convert `ChatMessage.role` from `String` to an enum
13. Reduce `ChatScreen` state surface area (14 `@State` variables)
14. Fix `ChatScreen` auto-scroll to respect user scroll position
15. Replace inline `RoundedRectangle + strokeBorder` with `Surface`

### Priority 4 — Polish

16. Add combined accessibility labels to all row views
17. Replace `ChatScreen` inline `.font(.system(size:))` with `AppTypography`
18. Disable or remove the "Delete account" no-op button
19. Verify whether `InboxScreen` is reachable in the current nav model; remove if dead

---

## Quick Wins

Tasks under 30 minutes with immediate payoff:

| Task | Time | Impact |
|---|---|---|
| Fix `.constant(sendError != nil)` alert in `ChatScreen` | 10 min | Fixes user-visible bug |
| Fix voice banner dismiss button | 5 min | Fixes user-visible bug |
| Cache `AppLock.isEnabled` | 15 min | Eliminates per-render Keychain I/O |
| Call `router.resetForSignOut()` in `OnboardingScreen` | 5 min | Prevents stale nav state |
| Delete `ContentView.swift` and `AuthLayout.accentBar` | 5 min | Remove dead code |
| Remove guard inside `AppButton.action` | 2 min | Remove unreachable code |
| Replace `.red.opacity(0.8)` with `Color.Hakumi.destructive` | 5 min | Token violation fix |
| Remove `.toolbarBackground(.hidden)` from `styledBars()` | 2 min | Remove redundant modifier |
| Disable or remove "Delete account" button | 5 min | Prevent silent no-op UX |
| Consolidate `Date.relativeString` into one extension | 30 min | Eliminate divergent output |

---

## Systemic Patterns

These anti-patterns appear in multiple files and should be addressed at the root, not file-by-file.

### 1. Singletons with no environment injection
Every service is `static let shared`. Views access them directly. This is the root cause of untestable previews, untestable views, and hidden coupling. `AppStores`, `ComposerState`, `AppLock`, `VoiceRecordingService`, and `ScreenCaptureService` are all affected. The fix is straightforward since everything is already `@Observable` — inject the two most view-facing ones (`AppStores`, `ComposerState`) via `.environment()` first.

### 2. Three near-identical list screens
`InboxScreen`, `NotesScreen`, and `SidebarView` are the same state machine (loading → error → empty → list → scroll-to-top) with ~80% identical code. The archive/delete logic, `scrollToTopIfPending` function, and `loadingView`/`errorView`/`emptyView` helpers are copy-pasted with minor variations. Each new list feature must be implemented three times.

### 3. Four independent `DateFormatter` implementations
`InboxScreen`, `NotesScreen`, `SidebarView`, and `ArchivedChatsScreen` each define `private extension Date { var relativeString: String }` with different logic and different copy ("now" vs "just now" for sub-60-second timestamps). The same item type can show different timestamps depending on which screen renders it.

### 4. `Surface` component used in one place
`Surface` / `Card` components exist and correctly encapsulate the `RoundedRectangle + fill + strokeBorder` pattern. They are used in exactly one screen (`ArchivedChatsScreen`). Every other screen assembles the same three-layer pattern inline, ~20 times total. A border-style change requires touching 20+ sites.

### 5. Silent failure on async operations
`// Non-fatal` catch blocks on note creation, chat send, archive, and route failures leave users with no feedback when things go wrong. At minimum, failed operations should log to an observability system. Several are marked `// TODO` and never received error UI.

### 6. `ChatMessage.role` is a raw `String`
Every consumer compares `message.role == "user"`, `message.role == "assistant"`, `message.role != "tool"`. A typo is a silent display bug. This should be a typed enum.

---

## Detailed Findings

---

### State Management

#### SM-1: `ComposerState.shared` as a computed property breaks `@Observable` tracking
- **Severity:** High
- **Location:** `SharedComposerCard.swift`
- **Problem:** `private var state: ComposerState { ComposerState.shared }` is a computed var that returns a global. SwiftUI's `@Observable` machinery instruments property accesses during `body` evaluation. A computed var returning a singleton is not registered as a dependency — the view will not re-render when `ComposerState` changes unless a parent re-renders it. The composer is the primary interactive surface; if observation silently breaks, the send button state, error banners, and recording indicator can stop updating.
- **Fix:**
```swift
// RootView:
.environment(ComposerState.shared)

// SharedComposerCard:
@Environment(ComposerState.self) private var state
```
- **Confidence:** High

---

#### SM-2: `AppLock.isEnabled` calls Keychain synchronously on every read
- **Severity:** High
- **Location:** `AppLock.swift`, `isEnabled` getter
- **Problem:** `AppLockStore.load()` calls `SecItemCopyMatching`, a synchronous blocking Keychain API. `isEnabled` is read during `SettingsScreen.body` evaluation — including while a `Toggle` is animating. On a slow device or immediately after boot when the Keychain service is busy, this causes perceptible jank on the main thread.
- **Fix:** Cache in memory on `init`, only write Keychain on `set`:
```swift
private var _isEnabled: Bool

var isEnabled: Bool {
    get { _isEnabled }
    set { _isEnabled = newValue; AppLockStore.save(newValue) }
}

private init() {
    _isEnabled = AppLockStore.load()
    isUnlocked = !_isEnabled
}
```
- **Confidence:** High

---

#### SM-3: `ChatScreen` has 14 `@State` variables
- **Severity:** Medium
- **Location:** `ChatScreen.swift`, lines 15–37
- **Problem:** The review sheet alone uses 5 separate `@State` vars (`showReviewSheet`, `reviewTitle`, `reviewContent`, `isSavingReview`, `reviewSaved`). Each is an independent source of truth that must be manually kept in sync. The search state (`showSearch` + `searchQuery`) is always toggled together.
- **Fix:** Group related state into local structs:
```swift
private struct ReviewDraft {
    var title = ""
    var content = ""
    var isSaving = false
    var saved = false
}
@State private var reviewDraft: ReviewDraft? = nil  // nil = sheet closed

// Search: single optional string (nil = hidden)
@State private var searchQuery: String? = nil
```
- **Confidence:** High

---

#### SM-4: `ComposerState` never resets on sign-out
- **Severity:** Medium
- **Location:** `Router.resetForSignOut()`, `ComposerState.swift`
- **Problem:** `router.resetForSignOut()` clears navigation state but `ComposerState.shared.target` and any persisted drafts survive. After sign-out/sign-in, a stale target and draft text from a previous session will appear in the composer.
- **Fix:** Add `ComposerState.reset()` and call it from `resetForSignOut()`.
- **Confidence:** High

---

#### SM-5: `isCreating`/`isSubmitting` bool flags swallow errors silently
- **Severity:** Low
- **Location:** `NotesScreen.createAndOpen()`, `SidebarView.createAndOpenNote()`, `ChatScreen.archiveChat()`
- **Problem:** All use `// Non-fatal` or `// TODO` empty catch blocks. Users lose their intent with no feedback when creation fails.
- **Fix:** Introduce a minimal `ActionState` enum (`idle`, `loading`, `failed(String)`) per action, or at minimum surface a toast on failure.
- **Confidence:** High

---

### Architecture / Business Logic in Views

#### ARCH-1: Raw networking inside `ArchivedChatsScreen`
- **Severity:** Critical
- **Location:** `ArchivedChatsScreen.swift`, lines 126–155
- **Problem:** `load()` constructs a `URLRequest` directly, calls `URLSession.shared.data(for:)`, manually parses JSON with `JSONSerialization`, and performs ISO 8601 date parsing — all in the view. The URL is built with string concatenation (`apiURL(...).absoluteString + "?limit=100"`), bypassing the `URLComponents`-based helpers used everywhere else. This is the only screen that does not use the service layer. It cannot be unit tested and will drift from the rest of the networking code.
- **Fix:**
```swift
// ChatService.swift
static func fetchArchivedChats() async throws -> [ArchivedChatSummary] {
    var components = URLComponents(url: apiURL("/api/chats"), resolvingAgainstBaseURL: false)!
    components.queryItems = [URLQueryItem(name: "limit", value: "100"),
                              URLQueryItem(name: "archived", value: "true")]
    var request = URLRequest(url: components.url!)
    request.timeoutInterval = 15
    request.applyAuthHeaders()
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw ChatError.fetchFailed
    }
    return try JSONDecoder.hakumi.decode([ArchivedChatSummary].self, from: data)
}

// ArchivedChatsScreen.swift
private func load() async {
    isLoading = true
    defer { isLoading = false }
    do { chats = try await ChatService.fetchArchivedChats() }
    catch { errorMessage = error.localizedDescription }
}
```
- **Confidence:** High

---

#### ARCH-2: Archive/delete logic copy-pasted across three views with incorrect rollback
- **Severity:** Medium
- **Location:** `InboxScreen.swift` lines 104–140, `NotesScreen.swift` lines 102–120, `SidebarView.swift` lines 126–175
- **Problem:** Identical optimistic-remove + service call + rollback pattern is copy-pasted in all three screens. The rollback in all three always inserts at index 0 regardless of the item's original position — if the user archives item #8, it reappears at the top on failure.
- **Fix:** Consolidate into `AppStores` using a snapshot-based rollback:
```swift
extension AppStores {
    @MainActor func archiveNote(_ note: InboxNote) async {
        let inboxSnapshot = inbox.data
        let notesSnapshot = notes.data
        inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.archiveNote(id: note.id)
        } catch {
            inbox.mutateData { $0 = inboxSnapshot }
            notes.mutateData { $0 = notesSnapshot }
        }
    }
}
```
- **Confidence:** High

---

#### ARCH-3: `ComposerState.submitPrimary` reaches into `AppStores.shared` directly
- **Severity:** Medium
- **Location:** `ComposerState.swift`, line ~219
- **Problem:** `ComposerState` references `AppStores.shared` directly to update the inbox store after note submission. This creates a circular singleton dependency. The intent was for views to orchestrate between the two; having `ComposerState` reach back into stores blocks injection of either.
- **Fix:** Pass the target store as a parameter to `submitPrimary`, or have the caller (view) supply a completion closure for the optimistic update.
- **Confidence:** Medium

---

#### ARCH-4: `OnboardingScreen` sets `router.authPhase` directly instead of `resetForSignOut()`
- **Severity:** Low
- **Location:** `OnboardingScreen.swift`, line ~59
- **Problem:** `router.authPhase = .unauthenticated` skips `resetForSignOut()`, which clears `authPath`, `sidebarSelection`, `showSettings`, `settingsPath`, and (once added) `ComposerState`. On sign-out from onboarding, stale navigation state can survive into the next session.
- **Fix:** Replace with `router.resetForSignOut()` or `await AuthProvider.shared.signOut()` which should call it.
- **Confidence:** High

---

### Performance

#### PERF-1: `DateFormatter` allocated per-cell in four separate `private extension Date` blocks
- **Severity:** High
- **Location:** `InboxScreen.swift`, `NotesScreen.swift`, `SidebarView.swift`, `ArchivedChatsScreen.swift`
- **Problem:** Every call to `.relativeString`, `.sidebarDateString`, or `.noteListDateString` allocates a new `DateFormatter` instance when the date falls outside the recent-time fast path. `DateFormatter` initialization costs ~1–2ms. In a 50-item list during scroll, this is 50–100ms of main-thread allocation per render pass.
- **Fix:** Use a shared static `RelativeDateTimeFormatter` in a single non-private `Date+Relative.swift` file:
```swift
// Date+Relative.swift
extension Date {
    private static let relFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f
    }()

    var relativeString: String {
        let diff = -timeIntervalSinceNow
        if diff < 60 { return "now" }
        return Date.relFormatter.localizedString(for: self, relativeTo: .now)
    }
}
```
- **Confidence:** High

---

#### PERF-2: Three conflicting `Date.relativeString` extensions
- **Severity:** Medium
- **Location:** `InboxScreen.swift`, `ArchivedChatsScreen.swift`, `SidebarView.swift`
- **Problem:** All three define `private extension Date { var relativeString: String }` with different sub-60-second copy: `InboxScreen` returns `"now"`, `ArchivedChatsScreen` returns `"just now"`. The same item type displays different timestamps depending on which screen renders it.
- **Fix:** One shared extension (see PERF-1).
- **Confidence:** High

---

#### PERF-3: `filteredNotes` / `filteredItems` recompute on every render without debounce
- **Severity:** Low
- **Location:** `NotesScreen.swift` line 12, `SidebarView.swift` line 17
- **Problem:** Both are unguarded computed properties that call `.lowercased()` on every item during every `body` evaluation. Every keystroke in the search field triggers a full re-filter over all items.
- **Fix:** Debounce `searchText` with `.onChange` and cache the filtered result in `@State`. In the medium term, move filtering into `QueryStore`.
- **Confidence:** High

---

#### PERF-4: `ChatScreen` re-registers three `onChange` scroll-to-bottom observers
- **Severity:** Low
- **Location:** `ChatScreen.swift`, lines ~181–189
- **Problem:** Three separate `onChange` handlers all call `proxy.scrollTo("chat-bottom")` unconditionally, including on background reloads. If the user has scrolled up to read history, any message change snaps them back to the bottom.
- **Fix:** Track whether the user is near the bottom; only auto-scroll when they are.
- **Confidence:** High

---

### Navigation / Presentation

#### NAV-1: `NoteDetailScreen` chat handoff uses note ID as chat ID (functional bug)
- **Severity:** Critical
- **Location:** `NoteDetailScreen.swift`, lines ~157–160
- **Problem:**
```swift
router.sidebarSelection = .chat(id: id)  // `id` is the note ID, not a chat ID
```
`ChatScreen` will attempt to load a chat with the note's ID. The server will return 404 or an unrelated result. `ChatScreen` fails silently with an empty/error state. The user sees a broken screen with no explanation.
- **Fix:** This requires the server to return an associated `chatId` on the note detail, or a "create/find chat for note" API call. Until that API exists, the button should be hidden or disabled.
- **Confidence:** High

---

#### NAV-2: `ChatScreen` alert binding traps users in a dismiss loop
- **Severity:** High
- **Location:** `ChatScreen.swift`, lines ~92–95
- **Problem:**
```swift
.alert("Send failed", isPresented: .constant(sendError != nil)) {
    Button("OK") { sendError = nil }
}
```
`.constant(sendError != nil)` creates a read-only binding with a no-op setter. When the user dismisses via system gesture (swipe down or tap outside), SwiftUI calls the binding's setter — which does nothing. `sendError` remains non-nil. The alert immediately re-presents. The user cannot dismiss it without tapping "OK".
- **Fix:**
```swift
.alert("Send failed", isPresented: Binding(
    get: { sendError != nil },
    set: { if !$0 { sendError = nil } }
)) {
    Button("OK") {}
} message: {
    Text(sendError ?? "")
}
```
- **Confidence:** High

---

#### NAV-3: `ArchivedChatsScreen` sets two `Router` properties in sequence
- **Severity:** Low
- **Location:** `ArchivedChatsScreen.swift`, lines 42–43
- **Problem:** `router.showSettings = false; router.sidebarSelection = .chat(id: chat.id)` — order-dependent, could flash intermediate state.
- **Fix:** Add `router.navigateToChat(id:)` that handles the transition atomically.
- **Confidence:** Medium

---

#### NAV-4: `styledBars()` applies two redundant toolbar background modifiers
- **Severity:** Low
- **Location:** `RootView.swift`, `styledBars()` extension
- **Problem:** `.toolbarBackground(.hidden, for: .navigationBar)` (iOS 15 API) and `.toolbarBackgroundVisibility(.hidden, for: .navigationBar)` (iOS 16+ API) are applied together. On iOS 16+, the newer API takes precedence; the iOS 15 modifier is ignored but clutters every navigation stack.
- **Fix:** Remove `.toolbarBackground(.hidden, for: .navigationBar)`. Keep `.toolbarBackgroundVisibility(.hidden, for: .navigationBar)` since the deployment target is iOS 18.
- **Confidence:** High

---

### Concurrency / Async

#### CONC-1: `VoiceRecordingService` audio tap closure reads `@MainActor` state off the main thread
- **Severity:** High
- **Location:** `VoiceRecordingService.swift`, lines ~66–79
- **Problem:** The `installTap(onBus:)` callback runs on an audio thread. Inside the closure, `self?.recognitionRequest?.append(buffer)` reads `recognitionRequest` — a `@MainActor`-isolated property. The `Task { @MainActor }` correctly dispatches the UI update to main, but the `recognitionRequest` read happens _before_ the task is created, on the audio thread. `stopEngine()` on the main actor can nil out `recognitionRequest` concurrently, causing a potential EXC_BAD_ACCESS.
- **Fix:** Extract the request into a `nonisolated(unsafe)` wrapper or use a `Sendable` actor-isolated buffer:
```swift
// Separate the audio-thread-accessible request from the main-actor state
private nonisolated(unsafe) var _recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
```
- **Confidence:** Medium (race is real; does not manifest on the happy path)

---

#### CONC-2: `ChatScreen.reloadMessages` double-fetches on error
- **Severity:** Medium
- **Location:** `ChatScreen.swift`, lines ~573–583
- **Problem:** On failure of the parallel `(messages, detail)` fetch, the code immediately retries with a second `ChatService.fetchMessages` call in the same error condition. Both calls use `try?` and swallow all errors. The retry doubles network latency on already-failing requests and silently drops the title update.
- **Fix:**
```swift
private func reloadMessages() async {
    do {
        async let msgs = ChatService.fetchMessages(chatId: id)
        async let detail = ChatService.fetchChatDetail(id: id)
        messages = try await msgs
        chatTitle = try await detail.title
    } catch {
        // surface error to user or log
    }
}
```
- **Confidence:** High

---

#### CONC-3: Fire-and-forget `Button { Task { } }` tasks not scoped to view lifetime
- **Severity:** Low
- **Location:** All screens with async button actions
- **Problem:** `Button { Task { await handleFoo() } }` creates unstructured tasks that are not cancelled when the view is removed from the hierarchy. In most cases this is acceptable for short API calls, but it becomes a risk as navigation becomes more complex (e.g., user navigates away while an archive is in flight).
- **Fix:** This is acceptable for the current complexity level. For operations that mutate navigated-away views, store the `Task` reference and cancel in `onDisappear`, or use `.task(id:)` where the operation is tied to a view-lifecycle trigger.
- **Confidence:** Medium

---

### Accessibility / UX

#### A11Y-1: Voice permission banner dismiss button has an empty action
- **Severity:** High
- **Location:** `SharedComposerCard.swift`, lines ~472–477
- **Problem:** `Button { } label: { Image(systemName: "xmark") }` — the dismiss button on the voice permission error banner does nothing. The banner cannot be closed without restarting the app or granting the permission. Blocks the composer accessory row.
- **Fix:**
```swift
Button { VoiceRecordingService.shared.clearPermissionError() } label: {
    Image(systemName: "xmark").font(.system(size: 11, weight: .semibold))
}
// VoiceRecordingService:
func clearPermissionError() { permissionError = nil }
```
- **Confidence:** High

---

#### A11Y-2: "Delete account" is a tappable no-op
- **Severity:** Medium
- **Location:** `SettingsScreen.swift`, lines ~247–263
- **Problem:** Button is interactive, styled as muted tertiary text (not visually disabled), and produces zero feedback on tap. The comment says "alert only" but no alert is shown. Users will assume the feature is broken.
- **Fix:** Add `.disabled(true)`, or show a "Coming soon" `confirmationDialog`, or remove the button until the feature is ready.
- **Confidence:** High

---

#### A11Y-3: List rows have no combined accessibility label
- **Severity:** Medium
- **Location:** `NoteRowView`, `InboxRowView`, `SidebarRow` in their respective screens
- **Problem:** VoiceOver reads individual `Text` elements in DOM order: "photo icon, Project discussion, Yesterday, chevron right". The date and icon are noise. Standard list apps provide a single composed label.
- **Fix:** `.accessibilityElement(children: .combine)` on the row container, or a custom `.accessibilityLabel("\(item.title), \(item.date.relativeString)")`.
- **Confidence:** High

---

#### A11Y-4: `ChatScreen` force-scrolls to bottom unconditionally
- **Severity:** Medium
- **Location:** `ChatScreen.swift`, three `onChange` scroll handlers
- **Problem:** All three handlers call `proxy.scrollTo("chat-bottom", anchor: .bottom)` on every message change, including background reloads. A user reading history gets snapped to the bottom.
- **Fix:** Track whether the user is within N points of the bottom (via `ScrollViewProxy` + `GeometryReader` on the last message) and only auto-scroll when they are.
- **Confidence:** High

---

#### A11Y-5: Auth screen "or" divider uses `Rectangle` instead of `Divider`
- **Severity:** Low
- **Location:** `AuthSignInView.swift`, lines ~41–50
- **Problem:** Two manual `Rectangle().fill(Color.Hakumi.borderDefault).frame(height: 1)` instances build a divider. `Divider` exists, respects the color scheme, and is idiomatic.
- **Fix:** Use `Divider()` with `.overlay(Text("or"))` or a simpler `LabeledDivider` component.
- **Confidence:** Medium

---

### Styling / Design System

#### DS-1: `RoundedRectangle + fill + strokeBorder` pattern repeated ~20 times; `Surface` used once
- **Severity:** Medium
- **Location:** `ChatScreen.swift`, `SettingsScreen.swift`, `SharedComposerCard.swift`, `NoteDetailScreen.swift`, `AppButton.swift`, and more
- **Problem:** The three-layer styling pattern appears in ~20 places:
```swift
.background(
    RoundedRectangle(cornerRadius: Radii.X, style: .continuous)
        .fill(someColor)
)
.overlay(
    RoundedRectangle(cornerRadius: Radii.X, style: .continuous)
        .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
)
```
The `Surface` component already encapsulates this. Changing border style requires updating 20+ sites.
- **Fix:** Use `Surface` or create a modifier:
```swift
extension View {
    func surfaceStyle(radius: CGFloat = Radii.sm, fill: Color = Color.Hakumi.bgSurface) -> some View {
        background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill))
        .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1))
    }
}
```
- **Confidence:** High

---

#### DS-2: `ChatScreen` bypasses `AppTypography` throughout
- **Severity:** Medium
- **Location:** `ChatScreen.swift`, ~8 inline `.font(.system(size: X))` calls
- **Problem:** Font sizes 11, 13, 15, 16, 17 map to existing `AppTypography` styles but are hardcoded. Design-token changes will not propagate to the chat screen.
- **Fix:** Audit each site; replace with the corresponding `AppTypography` style. Keep inline `.font` only for genuinely custom cases (e.g., monospaced timestamp).
- **Confidence:** High

---

#### DS-3: `.red.opacity(0.8)` used instead of `Color.Hakumi.destructive`
- **Severity:** Low
- **Location:** `SettingsScreen.swift`, lines ~188 and ~211
- **Problem:** Design system defines `Color.Hakumi.destructive` for error states. Two passkey error sites use raw `.red.opacity(0.8)`.
- **Fix:** Replace with `Color.Hakumi.destructive`.
- **Confidence:** High

---

#### DS-4: `AuthLayout.accentBar` is dead code
- **Severity:** Low
- **Location:** `AuthLayout.swift`
- **Problem:** `private var accentBar: some View` is defined but never referenced in `body`. Either removed from the design and the property was left behind, or planned and never wired up.
- **Fix:** Delete it.
- **Confidence:** High

---

### Data Flow / Dependencies

#### DATA-1: `AppStores.shared` accessed directly in every list view — untestable and unpreviewable
- **Severity:** Medium
- **Location:** `InboxScreen.swift`, `NotesScreen.swift`, `SidebarView.swift`
- **Problem:**
```swift
private var store: QueryStore<InboxItem> { AppStores.shared.inbox }
```
The store is inaccessible for injection. Previews trigger real `.fetch()` calls. Tests cannot swap the store for a fake. This pattern blocks the entire test/preview story for the three most important screens.
- **Fix:**
```swift
// RootView (or App.swift):
.environment(AppStores.shared)

// Each screen:
@Environment(AppStores.self) private var stores
private var store: QueryStore<InboxItem> { stores.inbox }

// Preview:
#Preview {
    InboxScreen()
        .environment(AppStores.preview)  // seed with mock data
}
```
- **Confidence:** High

---

#### DATA-2: `TopAnchorSignal.inbox` has two consumers; first one wins
- **Severity:** Medium
- **Location:** `InboxScreen.swift` line ~31, `SidebarView.swift` line ~71
- **Problem:** Both screens listen to `TopAnchorSignal.inbox` and call `markHandled()` in `scrollToTopIfPending()`. If both views are in the hierarchy simultaneously (possible in the `NavigationSplitView` layout where `SidebarView` is always visible), whichever `onChange` fires first consumes the signal. The other view's scroll never triggers. This is a non-deterministic race.
- **Fix:** Verify whether `InboxScreen` is still reachable in the current navigation model. If not, it is dead code and should be removed. If both are meant to coexist, replace `TopAnchorSignal.markHandled()` with a broadcast that all consumers can observe independently (e.g., a notification with a monotonic counter instead of a boolean).
- **Confidence:** High

---

#### DATA-3: Optimistic archive/delete rollback inserts at index 0
- **Severity:** Medium
- **Location:** `InboxScreen.swift`, `NotesScreen.swift`, `SidebarView.swift` — all archive/delete helpers
- **Problem:** All rollbacks insert at position 0 regardless of original position:
```swift
AppStores.shared.inbox.mutateData { $0.insert(.note(note), at: 0) }
```
If item #8 fails to archive, it reappears at the top of the list, visually jarring.
- **Fix:** Capture a full snapshot before mutation and restore it on failure (see ARCH-2 example).
- **Confidence:** High

---

### SwiftUI Idioms / Correctness

#### IDIOM-1: `AppButton.action` closure guards against disabled state (unreachable code)
- **Severity:** Low
- **Location:** `AppButton.swift`, line ~110
- **Problem:**
```swift
Button(action: { if !effectivelyDisabled { action() } }) { ... }
    .disabled(effectivelyDisabled)
```
The button is also `.disabled(effectivelyDisabled)`. SwiftUI's `.disabled()` modifier prevents the action from firing. The guard inside the closure is unreachable and implies `.disabled()` cannot be trusted.
- **Fix:** Remove the guard from the action closure.
- **Confidence:** High

---

#### IDIOM-2: `NoteDetailScreen.hasLoaded` is redundant with `note != nil`
- **Severity:** Low
- **Location:** `NoteDetailScreen.swift`
- **Problem:** `hasLoaded` is set to `true` only when `note` is successfully assigned. The guard `if hasLoaded, !isLoading` is equivalent to `if note != nil, !isLoading`. Two state variables encoding one condition.
- **Fix:** Replace `hasLoaded` checks with `note != nil`. Delete `hasLoaded`.
- **Confidence:** High

---

#### IDIOM-3: `ContentView.swift` is dead code
- **Severity:** Low
- **Location:** `ContentView.swift`
- **Problem:** Xcode template default. Never referenced by `App.swift` or any other file.
- **Fix:** Delete `ContentView.swift`.
- **Confidence:** High

---

### Testing / Previews

#### TEST-1: All screen previews make real network calls
- **Severity:** Medium
- **Location:** `#Preview` blocks in `InboxScreen`, `NotesScreen`, `SidebarView`, `ChatScreen`
- **Problem:** Screens access `AppStores.shared` and call `.fetch()` via `.task`. Previews hit the dev server at `localhost`. Without a running server the previews show error states. There is no mock data path. SwiftUI preview iteration is the fastest way to develop UI; making it network-dependent removes that benefit entirely.
- **Fix:** Blocked on DATA-1 (inject `AppStores` via environment). Once injected, previews can use a mock store:
```swift
extension AppStores {
    static var preview: AppStores {
        let stores = AppStores()
        stores.inbox.data = InboxItem.previews
        stores.notes.data = NoteItem.previews
        return stores
    }
}
```
- **Confidence:** High

---

#### TEST-2: `ChatMessage.role` is a raw `String`
- **Severity:** Medium
- **Location:** `ChatMessage.swift`, all consumers in `ChatScreen.swift`
- **Problem:** `message.role == "user"`, `message.role == "assistant"`, `message.role != "tool"` — string comparison throughout. A server-side typo or a client-side typo produces a silent display bug (wrong bubble style, no error).
- **Fix:**
```swift
enum MessageRole: String, Codable {
    case user, assistant, tool, system
}
struct ChatMessage: Identifiable, Codable {
    let role: MessageRole
    ...
}
```
- **Confidence:** High

---

## Appendix: Files Audited

| File | Status |
|---|---|
| `Navigation/RootView.swift` | Audited |
| `Navigation/Router.swift` | Audited |
| `Screens/Auth/AuthSignInView.swift` | Audited |
| `Screens/Auth/AuthLayout.swift` | Audited |
| `Screens/Auth/VerifyOTPView.swift` | Audited |
| `Screens/Inbox/InboxScreen.swift` | Audited |
| `Screens/Notes/NotesScreen.swift` | Audited |
| `Screens/Notes/NoteDetailScreen.swift` | Audited |
| `Screens/Chat/ChatScreen.swift` | Audited |
| `Screens/Settings/SettingsScreen.swift` | Audited |
| `Screens/Settings/ArchivedChatsScreen.swift` | Audited |
| `Screens/Sidebar/SidebarView.swift` | Audited |
| `Screens/Onboarding/OnboardingScreen.swift` | Audited |
| `Services/Composer/ComposerState.swift` | Audited |
| `Services/Query/QueryStore.swift` | Audited |
| `Services/Query/AppStores.swift` | Audited |
| `Services/Voice/VoiceRecordingService.swift` | Audited |
| `DesignSystem/Components/AppTextField.swift` | Audited |
| `DesignSystem/Components/AppButton.swift` | Audited |
| `DesignSystem/Components/SharedComposerCard.swift` | Audited |
| `DesignSystem/Components/Surface.swift` (Card.swift) | Audited |
| `DesignSystem/Tokens/` | Audited |
| `ContentView.swift` | Audited — dead code |
