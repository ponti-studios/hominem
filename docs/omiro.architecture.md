# Omiro architecture

This document describes the implemented iOS app structure. Product behavior
specific to chat, Time, or voice lives in the companion documents
[`omiro.chat.md`](omiro.chat.md), [`omiro.time.md`](omiro.time.md), and
[`omiro.voice.md`](omiro.voice.md).

## Platform and runtime

Omiro is an Expo Router application for Apple platforms only. The native iOS
project is Continuous Native Generation output: the app config, local Expo
modules, and config plugins are source; `apps/omiro/ios` is generated and must
not be hand-edited.

The root provider order is:

```text
Restyle theme -> React Navigation theme -> PersistQueryClientProvider
-> SafeAreaProvider -> GestureHandlerRootView -> KeyboardProvider
-> AuthProvider -> BottomSheetModalProvider -> protected shell / API provider
```

PostHog wraps this tree only when enabled. Sentry wraps the root layout when
enabled. Query state is persisted through MMKV and restored before the splash
screen is dismissed. The protected shell applies the app lock after
authentication and before exposing protected content.

## Route structure

The root layout separates `(auth)` and `(protected)` groups. The auth guard
redirects signed-out users away from protected routes and signed-in users away
from auth routes. The protected shell is not rendered until authentication and
query restoration have settled.

The implemented protected routes are:

| Route | Responsibility |
| --- | --- |
| `/(protected)` | Compatibility/home route; redirects to `/(protected)/stream`. |
| `/(protected)/stream` | Mixed content stream with `All`, `Chats`, and `Notes` filters. |
| `/(protected)/new-chat` | Empty chat-start surface with an optional `seed` parameter. |
| `/(protected)/chats/[id]` | Chat detail and message generation. |
| `/(protected)/chats/archived` | Archived chat list. |
| `/(protected)/notes/[id]` | Note detail and editing. |
| `/(protected)/time` | Time stream and natural-language Time composer. |
| `/(protected)/time/unscheduled` | Unscheduled task list. |
| `/(protected)/time/task/[id]` | Task time-block detail. |
| `/(protected)/time/event/[id]` | Calendar-event time-block detail. |
| `/(protected)/settings` | Protected form-sheet settings surface. |

Settings, enhance, and chat-to-note surfaces use native form-sheet
presentations. Navigation helpers in `services/navigation/routes.ts` are the
source of truth for content and Time-block URLs; IDs are encoded in routes.

There is no persistent tab bar. The Stream header uses a navigation drawer
button and a segmented filter. The app’s navigation hierarchy is product-owned;
do not add, remove, or relocate root destinations without an explicit product
decision.

## Content and state boundaries

The Stream combines API-backed chat and note items into a presentation-only
`ThreadViewModel`. Its `kind` remains either `chat` or `note`; presentation
language such as “thread” must not become a persisted content type or a
kindless query key.

The API provider supplies the authenticated client and TanStack Query cache.
Feature services own query keys and mutations:

- `services/inbox/` owns the mixed Stream query and refresh coordination.
- `services/chat/` owns chat queries, generation, message edits, retries,
  archive, search, and tool-call responses.
- `services/notes/` owns note queries and mutations.
- `services/tasks/` owns task queries, mutations, and Time parsing.
- `services/calendar/` owns the EventKit gateway and calendar queries.

Draft text and resume targets are local state. `launch-state.ts` stores Stream,
New Chat, per-chat drafts, and a one-shot resume target in MMKV. Route parameters
identify destinations and persisted entities; they do not replace
feature-owned state.

## Native boundaries

Local native modules are under `apps/omiro/modules/`:

- `voice-transcriber` exposes iOS SpeechAnalyzer transcription to JavaScript.
- `on-device-ai` exposes EventKit calendar operations and calendar-related
  on-device functionality.
- `omiro-intents` exposes the supported Apple intent entry points.

Shared UI packages may provide serializable design and motion contracts, but
Omiro owns the React Native/Reanimated adapters, Expo Router gestures, native
permissions, and product behavior. Shared UI must not import Omiro navigation
or native animation dependencies.

## Error and evidence boundaries

The root and protected shells provide app-level and feature-level error
boundaries. Network and feature failures should preserve recoverable local
input where the feature owns it. User-visible interaction changes require
Maestro evidence on the iPhone simulator plus visual inspection; unit tests
supplement but do not replace that evidence. The canonical local command is
`just mobile maestro [flow-or-directory]`.

Relevant implementation entry points:

- `apps/omiro/app/_layout.tsx`
- `apps/omiro/app/(protected)/_layout.tsx`
- `apps/omiro/services/navigation/routes.ts`
- `apps/omiro/services/navigation/launch-state.ts`
- `apps/omiro/services/query-persistence.ts`
