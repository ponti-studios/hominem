# Journal

- 2026-04-18T06:24:23Z: Created work item `top-anchor-scroll-restoration-and-inbox-sync`.
- 2026-04-18T10:15:00Z: Implemented top-anchor restoration and inbox sync.
  - `TopAnchorSignal` (`Services/Inbox/TopAnchorSignal.swift`): `@Observable @MainActor` singleton matching Expo's `pendingRequestId`/`handledRequestId` model. Future write surfaces (composer, note save) call `.inbox.request()` to trigger a scroll-to-top.
  - `InboxScreen` updated: added `ScrollPosition` binding (iOS 17+), `onChange(of: TopAnchorSignal.inbox.pendingRequestId)` → `scrollPosition.scrollTo(id: firstId)` + `markHandled()`.
  - Background sync: `.onAppear` triggers `refreshIfStale()` — refetches if last load was >30 s ago. Keeps inbox current when returning from a detail screen or switching tabs without user-visible displacement.
  - Scroll preservation: items updated with `withAnimation(.none)` so SwiftUI List diffs by ID without jump. Tab-bar re-tap scroll-to-top is handled natively by iOS for List inside NavigationStack.
  - Build verified: `BUILD SUCCEEDED`.
  - Follow-up: `TopAnchorSignal.inbox.request()` should be called from the composer and note-save surfaces once those are implemented.
