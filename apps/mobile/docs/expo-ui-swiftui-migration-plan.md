# Expo UI SwiftUI Migration Plan

Last updated: April 24, 2026

## Goals

- Improve iOS-native UI fidelity with `@expo/ui/swift-ui` where it provides clear product value.
- Treat SwiftUI as the default target for migrated screens because the app is iOS-only.
- Reduce migration risk by using screen-level SwiftUI islands before replacing shared primitives globally.

## Current State Snapshot

- Mobile code surface: ~91 files in `app/components/hooks` and ~11.5k LOC.
- Existing advanced UI dependencies:
  - `react-native-reanimated`
  - `react-native-gesture-handler`
  - `@gorhom/bottom-sheet`
  - `@shopify/flash-list`
  - `react-native-keyboard-controller`
  - `@expensify/react-native-live-markdown`
- iOS deployment target is `15.1` in app config.
- `@expo/ui` is already added and an iOS menu experiment exists in `components/workspace/InboxStreamItem.tsx`.

## Constraints From Expo UI SwiftUI

- `@expo/ui/swift-ui` is beta and subject to breaking changes.
- Not available in Expo Go; requires development builds.
- SwiftUI components must be inside `Host`.
- Inside a SwiftUI `Host`, Yoga/flexbox layout is not available; use `HStack/VStack/ZStack`.
- iOS-only scope means Android parity is not a migration requirement.

## Migration Strategy

- Do not replace `components/ui/*` globally at first.
- Build SwiftUI islands for target screens, then expand toward shared primitives once patterns are proven.
- Keep React Native implementations only where the current feature has no clean SwiftUI replacement yet.
- Add thin adapters for shared app-level props/events.

## Migration Matrix

### Screen Prioritization

| Screen / Flow             | Current File(s)                                                             | SwiftUI Fit |   Risk | Effort | Phase |
| ------------------------- | --------------------------------------------------------------------------- | ----------: | -----: | -----: | ----: |
| Archived chats            | `app/(protected)/(tabs)/settings/archived-chats.tsx`                        |        High |    Low |      S |     1 |
| Settings main             | `app/(protected)/(tabs)/settings/index.tsx`                                 |        High | Medium |      M |     1 |
| Auth email entry          | `app/(auth)/index.tsx`                                                      |        Done |    Low |      S |     2 |
| Auth verify OTP           | `app/(auth)/verify.tsx`                                                     |        Done |    Low |      S |     2 |
| Onboarding                | `app/(protected)/onboarding.tsx`                                            |        Done |    Low |      S |     2 |
| Sidebar item menus        | `components/workspace/InboxStreamItem.tsx`                                  |        High |    Low |      S |     1 |
| Feed list shell           | `app/(protected)/(tabs)/index.tsx` + `components/workspace/InboxStream.tsx` |      Medium | Medium |      M |     3 |
| Chat detail screen shell  | `app/(protected)/(tabs)/chat/[id].tsx`                                      |      Medium | Medium |      M |     3 |
| Chat conversation actions | `components/chat/conversation-actions.tsx`                                  |        Done | Medium |      S |     3 |
| Classification review     | `components/chat/classification-review.tsx`                                 |        Done | Medium |      S |     3 |
| Chat message controls     | `components/chat/chat-message.tsx`                                          |        Done | Medium |      M |     3 |
| Chat search modal         | `components/chat/chat-search-modal.tsx`                                     |        Done | Medium |      S |     3 |
| Notes detail shell        | `app/(protected)/(tabs)/notes/[id].tsx`                                     |     Low-Med |   High |      L |     4 |
| Composer surfaces         | `components/feed/FeedComposer.tsx`, `components/chat/ChatInput.tsx`         |         Low |   High |     XL |     4 |
| Voice/camera bottomsheets | `components/media/*`                                                        |     Low-Med |   High |      L |     4 |
| Error fallbacks           | `components/error-boundary/*`                                               |        Done |    Low |      S |     2 |
| Not found route           | `app/+not-found.tsx`                                                        |        Done |    Low |      S |     2 |
| Empty states              | `components/ui/EmptyState.tsx`                                              |        Done |    Low |      S |     2 |

### Component Mapping

| Current Pattern              | Typical File(s)                | SwiftUI Candidate                              | Notes                                                            |
| ---------------------------- | ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| `Pressable` row actions      | settings, archived, inbox rows | `Button`, `Menu`, `ContextMenu`                | Strong iOS-native behavior gain.                                 |
| `TextInput` simple fields    | auth/settings inline fields    | `TextField`, `SecureField`                     | Use modifiers: `keyboardType`, `submitLabel`, `textContentType`. |
| `Switch` toggles             | settings                       | `Toggle`                                       | Natural mapping with native semantics.                           |
| `ScrollView` forms           | settings/auth                  | `Form`, `Section`, `List`, `ScrollView`        | Prefer full SwiftUI subtree in one `Host`.                       |
| Modal action sheets          | conversation/menu modal        | `BottomSheet`, `Popover`, `ConfirmationDialog` | Evaluate behavior parity before replacing.                       |
| `ActionSheetIOS` menus       | composer/media pickers         | `Menu` (where practical)                       | For media source selection keep native APIs if needed.           |
| `FlatList`/`FlashList` feeds | inbox/chat lists               | `List`                                         | Keep FlashList where performance critical until measured.        |
| Reanimated transitions       | many components                | SwiftUI animation modifiers                    | Migrate per-screen; avoid mixed animation ownership initially.   |
| Markdown live editor         | notes editor                   | none (direct)                                  | Keep RN stack for now.                                           |
| Input accessory toolbar      | `NoteToolbar.tsx`              | none (direct parity unclear)                   | Keep RN implementation for now.                                  |

## Architecture Design

### Folder Pattern

For migrated screens, prefer a single SwiftUI implementation in the route file unless the file becomes hard to read. Split only when complexity asks for it:

- `FeatureName.swiftui.tsx`
- `FeatureName.types.ts`
- `route.tsx` keeps hooks/navigation and renders the SwiftUI view

Example:

- `ArchivedChatsScreen.swiftui.tsx`
- `ArchivedChatsScreen.types.ts`
- `archived-chats.tsx` owns data fetching and navigation.

### Shared Adapter Contracts

Define stable props contracts in `types` files:

- Input data (`items`, `loading`, `error`).
- Navigation callbacks (`onOpenChat`, `onClose`, etc.).
- Event callbacks (`onToggle`, `onSubmit`).

This keeps data/query logic in existing hooks while UI implementations diverge safely.

### Host Boundary Rules

- Prefer one `Host` at screen root for SwiftUI screens.
- Avoid many nested Hosts in scrolling content.
- Keep RN children inside SwiftUI only when necessary; re-enter SwiftUI with explicit new `Host`.

## Phased Rollout

### Phase 1

- Convert archived chats screen to SwiftUI island on iOS.
- Convert/finish inbox long-press menu with SwiftUI `Menu`/`ContextMenu` on iOS.
- Begin settings section conversion (account + privacy).

Success criteria:

- No regression in navigation.
- Typecheck and lint pass.
- iOS behavior parity for actions.

### Phase 2

- Convert auth entry and verify screens to SwiftUI.
- Keep auth state machine/services untouched.

### Phase 3

- Evaluate feed/chat shell list rendering with SwiftUI `List` vs current list stacks.
- Run perf testing on large data sets before replacing FlashList-backed experiences.

### Phase 4

- Revisit composers, notes editor, and media flows only after parity strategy is proven.

## Risk Register

- Beta API changes in Expo UI.
- iOS feature/version gating (some APIs require iOS 16/17/18+).
- Performance issues with too many Host boundaries.

Mitigation:

- Use feature flags for migrated screens.
- Migrate and verify incrementally.

## Immediate Execution Plan

1. Land archived chats SwiftUI implementation.
2. Land settings SwiftUI implementation.
3. Validate navigation and theming on iOS dev build.
4. Convert feed list shell after iOS device QA on completed settings and auth screens.

## Progress

- Archived chats is now rendered with SwiftUI `Host`, `Form`, `Section`, and native buttons.
- Settings is now rendered with SwiftUI `Host`, `Form`, `Section`, `TextField`, `Toggle`, and native buttons.
- Auth email entry is now rendered with SwiftUI `Host`, `Form`, `Section`, `TextField`, `ProgressView`, and native buttons.
- Auth OTP verification is now rendered with SwiftUI `Host`, `Form`, `Section`, `TextField`, `ProgressView`, and native buttons.
- Onboarding is now rendered with SwiftUI `Host`, `Form`, `Section`, `TextField`, and native buttons.
- The old RN `components/AuthLayout.tsx` wrapper has been removed.
- Default error fallbacks are now rendered with SwiftUI `Host`, `VStack`, `Image`, `Text`, and native buttons.
- The old RN `components/error-boundary/ErrorMessage.tsx` helper has been removed.
- The not-found route is now rendered with SwiftUI `Host`, `VStack`, `Image`, `Text`, and a native button.
- Shared empty-state content is now rendered with SwiftUI while keeping the RN `FadeIn` wrapper for stable list embedding.
- Chat conversation actions now render their sheet content with SwiftUI `Host`, `VStack`, `Text`, and native buttons while preserving the existing RN modal shell.
- Classification review now uses SwiftUI native buttons for accept/discard while preserving the existing RN animated sheet and preview.
- Chat message active controls and edit modal actions now use SwiftUI native buttons and SF Symbols while keeping RN message layout and multiline editing.
- Chat search now uses a SwiftUI `TextField` and native close button, with the controller ref migrated to Expo UI `TextFieldRef`.
- The note title field now uses a SwiftUI `TextField`; the live markdown body remains RN until a dedicated editor parity strategy is chosen.
- Inbox rows now use the SwiftUI `Menu` implementation directly for the iOS-only app, without the previous platform fallback branch.
- Dead RN form primitives (`Button`, `TextField`, `TextArea`, `Field`, and their local prop type files) have been removed after all direct usages were migrated.
- Feed composer attachment/voice icon actions now use SwiftUI native buttons, and the old RN `IconButton` wrapper has been removed.
