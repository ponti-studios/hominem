# Chat Capabilities

A client-side capability inventory for chat: what Omiro's chat client owns and
how verified each piece is, followed by how `apps/web`'s chat client compares.
Server and database implementation are outside scope except where the client
contract identifies the transport boundary. Motion/UX design decisions live in
[chat.design.md](chat.design.md).

## Status legend

- **Implemented** — client behavior is wired and has focused automated or flow
  coverage.
- **Partial** — the client has a visible or structural seam, but the behavior
  is incomplete, only conditionally wired, or lacks acceptance coverage.
- **Unverified** — code or a client contract suggests the capability, but there
  is no confirmed Omiro acceptance path in the current inventory.

## Part I — Omiro capabilities

### User journeys and entry points

| Journey | User-facing behavior | Client ownership | State, cache, and handoff | Status |
| --- | --- | --- | --- | --- |
| Capture from All | The mixed composer accepts ordinary text, attachments, and voice input; the user can choose or infer chat versus note submission. | `components/home/HomeScreen.tsx`, `components/composer/Composer.tsx`, `components/composer/useComposerController.ts`, `components/composer/useComposerSubmission.ts` | Inbox data uses `inboxKeys`; draft text and chat-composer attachment handoff use `services/navigation/launch-state.ts`. | Implemented |
| Resume or start a chat | The protected root opens the latest active chat. With no active chat it opens New Chat, whose first accepted message creates the conversation and replaces the blank route. | `components/home/ChatEntryScreen.tsx`, `components/home/NewChatScreen.tsx`, `components/composer/useStartChatSubmission.ts`, `services/chat/use-start-chat.ts` | `chatKeys.latest` resolves the root; `chatKeys.activeChat(id)` and `chatKeys.messages(id)` are seeded from the SSE `accepted` event. `/api/chats/start-stream` is the transport boundary. | Implemented |
| Browse active chats | Chats is the paginated active-conversation history. A row opens its persisted route and long press archives it. | `components/chat/ChatsScreen.tsx`, `services/chat/use-chats-list.ts` | Cursor pages use `chatKeys.list`; archive invalidates the pages and rolls back its inbox removal on error. | Implemented |
| Open chat detail | Chat detail is reached at `/(protected)/inbox/chat/[id]`; the compatibility `/inbox` route redirects to All. | `app/(protected)/inbox/[kind]/[id].tsx`, `components/inbox/ChatScreen.tsx`, `services/navigation/routes.ts` | `useActiveChat(id)` and `useChatMessages({ chatId })` hydrate the screen; resume state is written and cleared by `launch-state.ts`. | Implemented |
| Resume/deep link | The current chat is remembered as a resume target and content routes preserve the `chat` kind and ID. Missing or deleted conversations offer a back-to-All recovery state. | `components/inbox/ChatScreen.tsx`, `services/navigation/launch-state.ts`, `services/navigation/routes.ts` | Resume target is local state; 404 handling derives `isConversationGone` from active-chat or message errors. | Implemented |
| Archived chats | Archived chats are available from Settings and are indexed separately from the active inbox. | `hooks/useArchivedChats.ts`, `services/chat/chat-lists.ts`, `app/(protected)/settings/archived-chats.tsx` | `chatKeys.archivedChats` stores IDs; archived chat details are seeded into `chatKeys.detail(id)`. | Implemented |

### Chat detail capabilities

| Capability | Entry point and behavior | Client owner | Loading/error/interaction states | Coverage | Status |
| --- | --- | --- | --- | --- | --- |
| Load message history | Fetch up to 50 messages, remove tool-role rows from the render model, preserve render keys, and support pull-to-refresh. | `services/chat/use-chat-messages.ts`, `hooks/use-chat-data.ts`, `components/chat/chat-message-list.tsx` | Initial loading, restored cached data, refresh, empty conversation, missing conversation, and retry are represented in the screen. | `tests/services/chat/use-chat-messages.test.tsx`, `tests/services/chat/chat-messages.test.ts`, restored-query tests | Implemented |
| Send a message | Chat composer submits text, uploaded file IDs, referenced note IDs, and optional response modality. | `components/composer/useComposerSubmission.ts`, `services/chat/use-send-message.ts`, `components/inbox/ChatScreen.tsx` | Optimistic user row, offline rejection, generation stages, committed assistant reply, cancellation, failure, and retry. | `tests/services/chat/use-send-message.test.tsx`, `tests/services/chat/stream-sse.test.ts` | Implemented |
| Start-chat streaming | The All and New Chat composers use a separate stream that creates the chat and streams the first assistant response after acceptance. | `services/chat/use-start-chat.ts` | Navigation occurs only after accepted user-message state; incomplete starts are rejected without a route handoff. | `tests/services/chat/use-start-chat.test.tsx`, `tests/flows/chat-back-to-all.yaml`, `tests/flows/chat-first-home.yaml` | Implemented |
| Cancel generation | The active generation can be stopped through the generation cancel endpoint and local `AbortController`. | `services/chat/use-send-message.ts`, `services/chat/use-regenerate-message.ts`, `components/chat/chat-message-list.tsx` | `preparing`, active status, `stopping`, `cancelled`, and cancel failure are modeled by `ChatGenerationState`. | Focused hook tests exist; no dedicated Maestro cancellation flow found. | Partial |
| Retry failed response | Failed user sends and interrupted assistant responses expose retry actions; last input or target message is retained locally. | `components/chat/chat-message.tsx`, `services/chat/use-send-message.ts`, `components/chat/chat-message-list.tsx` | Failed rows, interrupted rows, and retry callbacks are rendered; retry concurrency and recovery need flow verification. | Hook/service tests cover adjacent stream behavior; no dedicated acceptance flow found. | Partial |
| Regenerate assistant response | An assistant message can request a replacement response through the regeneration stream. | `services/chat/use-regenerate-message.ts`, `components/inbox/ChatScreen.tsx`, `components/chat/chat-message-actions.tsx` | Active generation, cancellation, failure, retry, and cache replacement are modeled. Ordering semantics are governed by the open regeneration task documents. | `tests/services/chat/*` includes stream and haptic coverage; no dedicated regeneration Maestro flow found. | Partial |
| Edit user message | A user message opens an edit modal, trims non-empty content, optimistically updates the message, and rolls back on failure. | `components/chat/chat-message.tsx`, `components/chat/chat-message-edit-modal.tsx`, `services/chat/use-edit-message.ts` | Edit is disabled while streaming; mutation invalidates the message query after settle. | `tests/services/chat/use-edit-message.test.tsx` | Implemented |
| Delete message | Message rows accept an optional delete callback and render a destructive action when supplied. | `components/chat/chat-message.tsx`, `components/chat/chat-message-actions.tsx`, `components/chat/chat-message-list.tsx` | `ChatScreen` currently passes edit/regenerate/retry but not `onDelete`; no Omiro client delete mutation was found. | No client delete acceptance coverage found. | Partial — UI seam only |
| Copy/share response | Assistant message actions copy text or create a temporary text file for the native share sheet. | `components/chat/chat-copy-button.tsx`, `components/chat/chat-share-button.tsx`, `hooks/use-message-actions.ts` | Only non-empty, non-streaming assistant content is eligible. | No focused chat share/copy flow found. | Partial |
| Speak response | Assistant messages with audio URLs can start/stop native playback keyed by message ID. | `components/chat/chat-speak-button.tsx`, `components/media/useAudioPlayback.ts`, `components/media/audio-playback.service.ts` | Playback is singleton-style; active message and playing state are externally observable. | Audio playback tests exist outside the chat flow; no dedicated chat speech acceptance flow found. | Partial |
| Message presentation | User/assistant bubbles render Markdown, timestamps, reasoning, referenced notes, tool calls, focus items, thinking state, interruption state, and debug details. | `components/chat/chat-message.tsx`, `chat-message-content.tsx`, `chat-message-tool-calls.tsx`, `chat-message-referenced-notes.tsx`, `chat-message-debug.tsx` | Streaming suppresses Markdown enhancement; reduced motion changes transitions; action controls activate per message. | `tests/components/chat/*` and message/action unit coverage are present, but broad visual state coverage is absent. | Implemented |
| Search messages | Toolbar search opens a modal, debounces input, queries message search, and swaps the displayed list for results. | `hooks/use-chat-search.ts`, `components/chat/chat-search-modal.tsx`, `components/chat/chat-message-list.tsx` | Empty query keeps the local list; search close clears query; empty results have dedicated copy. | `tests/hooks/use-chat-search.test.ts`, `tests/hooks/use-chat-search.render.test.tsx` | Implemented |
| Response length | Settings sheet persists short/medium/long response length for subsequent generation requests. | `components/chat/chat-settings-sheet.tsx`, `hooks/use-chat-response-length.ts` | Default medium; slider selection and dismiss/done behavior are local-persistence states. | `tests/hooks/use-chat-response-length.test.tsx` | Implemented |
| Conversation actions | Toolbar exposes search, settings, debug, chat-to-note/task transforms, and archive. | `components/chat/chat-actions-menu.tsx`, `components/chat/conversation-actions.model.ts`, `components/inbox/ChatScreen.tsx` | Actions disappear for missing conversations; archive optimistically removes inbox item and returns to All. | Archive unit tests and chat Maestro flows exist; menu-state acceptance coverage is incomplete. | Implemented |
| New chat from detail | Toolbar opens the focused New Chat route without creating an empty persisted conversation. | `components/inbox/ChatScreen.tsx`, `components/home/NewChatScreen.tsx` | The route is replaced only after the start stream emits its accepted user message. | `tests/services/chat/use-start-chat.test.tsx` | Implemented |
| Auto-title | The first meaningful message can replace the default chat title while preserving an existing custom title. | `services/chat/use-auto-update-chat-title.ts`, `services/chat/chat-title.ts`, `components/composer/useComposerSubmission.ts` | Cache is updated optimistically; failed patch invalidates the active-chat query. | `tests/services/chat/use-auto-update-chat-title.test.tsx`, `tests/services/chat/chat-title.test.ts` | Implemented |
| Task extraction | Chat actions can extract tasks from the conversation and show a review overlay before content creation. See the [task-creation contract](chat.task-creation.md). | `hooks/use-task-extraction.ts`, `components/chat/chat-review-overlay.tsx`, `components/chat/chat-activity-timeline.tsx` | Pending review, accept, reject, loading, error, and inbox invalidation are modeled. | `tests/hooks/use-task-extraction.test.ts`, `tests/hooks/use-task-extraction.integration.test.tsx`; no dedicated acceptance flow yet | Partial |
| Chat to note | Conversation actions build a note draft from the transcript and navigate to the note draft sheet. | `components/chat/build-note-draft.ts`, `components/inbox/ChatScreen.tsx`, `app/(protected)/note-draft-sheet.tsx` | Empty transcript is rejected; truncation and title are carried in route params. | `tests/components/chat/build-note-draft.test.ts`, `tests/flows/chat-to-note.yaml` | Implemented |
| Tool-call approval | Message data supports tool calls and the client renders their details. | `components/chat/chat-message-tool-calls.tsx`, `services/chat/chatMessages.ts` | No client approval/rejection action was found in the inspected Omiro surface. | No Omiro acceptance coverage found. | Unverified |

### Composer capabilities used by chat

| Capability | Client ownership | Chat-specific behavior | Status |
| --- | --- | --- | --- |
| Text draft | `components/composer/ComposerInput.tsx`, `useComposerDraft.ts`, `ComposerContext.tsx` | Chat mode owns a draft per `chatId`; submission clears it after the send handoff. | Implemented |
| Chat/note kind selection | `ComposerKindToggle.tsx`, `ComposerKindSubmitPill.tsx`, `composerInference.ts` | Inbox mode can infer or manually select chat versus note; chat detail is fixed to chat mode. | Implemented |
| File/media attachments | `ComposerAttachButton.tsx`, `ComposerAttachmentRow.tsx`, `services/files/use-file-upload.ts` | Upload completion produces file IDs passed into start/send chat payloads; busy state disables conflicting actions. | Partial — no dedicated chat attachment flow found. |
| Voice capture and walkie-talkie | `useSpeechToText.ts`, `chat-composer-panel.tsx`, `speech-player.tsx` | Chat can submit voice or walkie-talkie turns with `responseModality: 'audio'` and automatically play the committed assistant audio; normal voice input inserts text into the draft. | Partial — browser autoplay fallback and acceptance coverage are present, but broad browser-matrix coverage is absent. |
| Inline enhance | `services/ai/use-inline-enhance.ts`, `components/composer/ComposerToolbar.tsx` | Composer can open enhancement while composing; this is shared with notes and not a chat transcript action. | Partial |
| New-message entrance | `components/chat/chat-message.tsx`, `components/chat/chat-message-list.tsx` | A just-sent user row lifts and fades in at its own list position (no composer-sourced flight); historical rows mount with no entrance. See [chat.design.md](chat.design.md). | Implemented — no dedicated motion unit test or simulator acceptance flow found. |

### Query and local-state boundaries

- `chatKeys.activeChat(id)` stores the active chat record.
- `chatKeys.messages(id)` stores mapped renderable messages and is used for
  optimistic sends, edit rollback, regeneration replacement, and restored
  query state.
- `chatKeys.archivedChats` stores the archived ID index; archived records are
  cached separately by detail ID.
- `chatKeys.list` stores cursor-paginated active-chat pages; `chatKeys.latest`
  stores the root-resolution page independently from the history screen.
- `inboxKeys.page(...)` is the mixed All list. Chat create, commit, archive,
  task extraction, and note transformation invalidate or patch inbox data.
- `services/navigation/launch-state.ts` owns resume targets, All and New Chat
  drafts, and chat-composer attachment handoff state. Route params carry only
  deep-linkable content IDs and draft-sheet values.
- `services/chat/stream-sse.ts` is the shared transport parser for both the
  start-chat and existing-chat generation paths. The client consumes accepted,
  status, committed, cancelled, and error lifecycle events.

### Verification matrix

#### Existing focused coverage

| Area | Current tests/flows |
| --- | --- |
| Chat services | `tests/services/chat/use-chat-messages.test.tsx`, `use-send-message.test.tsx`, `use-start-chat.test.tsx`, `use-edit-message.test.tsx`, `use-chat-archive.test.tsx`, `use-auto-update-chat-title.test.tsx`, `chat-title.test.ts`, `chat-messages.test.ts`, `stream-sse.test.ts` |
| Chat hooks | `tests/hooks/use-chat-data.test.tsx`, `use-chat-search.test.ts`, `use-chat-search.render.test.tsx`, `use-chat-response-length.test.tsx`, `useArchivedChats.test.tsx`, `use-task-extraction*.test*` |
| Chat component logic | `tests/components/chat/build-note-draft.test.ts`, inbox thread view-model tests, message-action tests |
| Maestro flows | `tests/flows/chat-back-to-all.yaml`, `chat-to-note.yaml`, `chat-first-home.yaml`, plus chat states in `screenshot-tour.yaml` |
| Persistence/navigation | `tests/services/query-persistence.test.ts`, `tests/services/navigation/launch-state.test.ts`, `tests/services/navigation/routes.test.ts` |

#### Acceptance gaps

- Add simulator evidence for send, cancellation, retry, and regeneration,
  including interruption, duplicate-submit prevention, and offline recovery.
- Add a chat attachment flow covering picker, upload failure, removal, and
  successful file-ID submission.
- Add a chat voice flow covering permission denial, transcription failure,
  cleanup, normal insertion, and audio-response submission.
- Add message action coverage for copy, share, speak, edit, and the currently
  unwired delete path.
- Add tool-call rendering and approval/rejection coverage, or record the
  capability as intentionally unavailable on the client.
- Add new-chat-from-detail, settings response-length, search, archive, missing
  conversation, and deep-link/resume acceptance states.
- Add visual evidence for message reasoning, references, tool calls, audio,
  failed rows, review overlay, reduced motion, and smallest supported viewport.

### Open client questions

- Is message deletion intended for Omiro? The component contract exposes it,
  but there is no client mutation or screen callback.
- Are tool-call approval and rejection intentionally API-only, or should Omiro
  expose controls in `MessageToolCalls`?
- Should cancellation and regeneration receive dedicated Maestro flows before
  either capability is considered fully verified?
- ~~Should chat attachment and voice behavior be treated as chat acceptance
  criteria, or only as shared-composer coverage?~~ Resolved: composer-level
  coverage, evaluated per platform (Web and Omiro each implement their own
  composer — there is no shared `@hominem/chat` controller). See
  [chat.composer-audio-modality.md](decisions/chat.composer-audio-modality.md).

### Recommended follow-up order

1. Resolve the delete and tool-call ownership questions so the inventory does
   not overstate available message actions.
2. Close acceptance gaps around generation lifecycle, especially cancellation,
   retry, regeneration, and offline recovery.
3. Verify shared composer capabilities in chat mode: attachments, voice, and
   audio response submission.
4. Add the remaining navigation, action-menu, accessibility, and visual-state
   evidence.

## Part II — Web parity (`apps/web` vs. Omiro)

This part covers user-facing behavior and client ownership only. A feature is
**missing** when no web implementation was found, **partial** when a web seam
exists but does not match Omiro's behavior or is stubbed, and **present** when
the web client has a working equivalent. Remaining implementation work for
this gap map is tracked as standardized Linear-style tasks in `docs/tasks/`,
starting at `web-chat-reinventory-matrix.md`; earlier phases of
this project, including `composer-parity.md`, were completed and their task
specs removed — see [chat.composer-audio-modality.md](decisions/chat.composer-audio-modality.md)
and [chat.composer-error-recovery.md](decisions/chat.composer-error-recovery.md)
for what that phase decided and built.

### Executive summary

`apps/web` currently supports the core conversation loop: open a chat, load up
to 50 messages, send text with files or note references, stream a committed
assistant response, cancel the browser request, use browser speech-to-text,
play generated speech, and approve or reject tool calls.

The largest missing areas are:

1. Omiro's mixed All/inbox capture model and chat-to-note/task workflows.
2. Message lifecycle actions: edit, delete, retry, and regenerate.
3. Conversation management: search, response settings, debug, title behavior,
   and complete archive handling.
4. Omiro-specific voice/audio behavior, offline/recovery states, and acceptance
   coverage.

### Feature gap map

| Omiro capability | Web status | Evidence in `apps/web` | Gap or parity note |
| --- | --- | --- | --- |
| Mixed All/inbox surface | **Missing** | `routes/home.tsx` redirects to the latest chat or creates one; `routes/layout.tsx` renders chat navigation. | Web has no Omiro-style mixed chronological stream of chats and notes, and no equivalent inbox entity adapter. |
| Inbox composer with chat/note inference | **Missing** | The only chat composer is in `routes/chat/chat.$chatId.tsx`; web has no shared mixed composer or kind toggle. | Missing Omiro's entry-mode inference, sticky manual chat/note selection, inbox draft persistence, and note submission path. |
| Start chat from the mixed composer | **Partial** | `components/chat-navigation.tsx` creates an empty chat; `routes/home.tsx` can create and redirect. | Web can create a blank chat, but does not submit the first message through Omiro's accepted-message start stream from a mixed composer. |
| Browse recent chats | **Present** | `hooks/use-chats.ts`, `components/chat-navigation.tsx`, `routes/chats.tsx`. | Web has sidebar and paginated chat list equivalents, but not the mixed All stream or Omiro activity/indexing model. |
| Chat detail route | **Present** | `routes/chat/chat.$chatId.tsx`, route registration in `app/routes.ts`. | Direct web route exists at `/chat/:chatId`; it does not use Omiro's protected inbox route or resume-target state. |
| Resume target and deep-link recovery | **Partial** | Direct `/chat/:chatId` navigation works; the route loader seeds messages; a missing-conversation screen exists (`ChatConversationState kind="not-found"`, "Conversation unavailable" with a start-new-chat action, `compute-chat-load-state.ts` 404 handling; e2e `LAUNCH-03`/`LAUNCH-04`, `UI-01`/`UI-02`). | No equivalent of Omiro's local resume target, consumed launch state, or `kind`-preserving content route was found. |
| Load history and refresh | **Partial** | `lib/hooks/use-chat-messages.ts` fetches 50 messages with React Query; loader provides initial data; not-found and retry are exposed (`isNotFound`, `retry: messagesQuery.refetch`, `onRetryLoad` in the route; hook tests); restored-vs-initial semantics via `compute-chat-load-state.ts`. | No Omiro-style pull-to-refresh; explicit empty state unverified. |
| Send message with optimistic user row | **Present** | `routes/chat/chat.$chatId.tsx`, `lib/hooks/use-stream-message.ts`. | Web seeds an optimistic row and reconciles it on `accepted`; it does not carry Omiro's generation-stage model or durable failed-row behavior. |
| Assistant streaming lifecycle | **Present** | `use-stream-message.ts` consumes `accepted`, `committed`, `error`, and `generation.cancelled`; the route shows `Shimmer` while thinking; stopping/cancelled/failed states with durable checkpoint restore and replay (`use-stream-message.test.tsx`). | Stage vocabulary differs from Omiro's preparing/saving model; no shared SSE parser. |
| Cancel generation | **Present** | `use-stream-message.ts` passes the abort signal into the request and calls the generation cancel endpoint before aborting (`chatClient.cancel`); durable cancelled state with cancel-failure and double-cancel guards (`use-stream-message.test.tsx`); regenerate and start-chat hooks share the pattern; e2e `RECOVER-02`, `RECOVER-03`. | Server and client cancellation agree; reload races covered by `RECOVER-04`/`RECOVER-05`. |
| Retry failed send/response | **Present** | `retryGeneration` in `use-chat-composer-submission.ts` (gated on online); failed sends restore draft and attachments and mark the generation retryable (`onFailed`); e2e `RECOVER-01` retries without a duplicate user message. | Interrupted-assistant retry beyond generation retry unverified. |
| Regenerate assistant response | **Present** | `lib/hooks/use-regenerate-message.ts` with transport, cancellation, and retry, wired into `chat.$chatId.tsx` with `responseLength`; e2e `SEND-05`, `UI-04`; hook tests and stories. | Cache replacement handled by message invalidation on settle. |
| Edit user message | **Present** | `app/components/chat/use-chat-message-edit.ts` with edit UI in the message actions ("Edit message"); e2e `UI-03`; hook tests. | Covered by hook tests and e2e `UI-03`. |
| Delete message | **Present** | Real `deleteMessage` mutation in `lib/hooks/use-chat-messages.ts`, `onDelete` wired in `chat.$chatId.tsx`; e2e `UI-03`; hook tests including missing-row and network-error paths. | Omiro's detail screen does not pass delete either, so parity meets the shared ceiling. |
| Copy/share message | **Present** | `chat-message-actions.tsx`: clipboard copy with copied/failed states, `navigator.share` with shared/failed states, speech playback; e2e `UI-04`. | Per-message download not offered; whole-conversation download remains separate. |
| Speech playback | **Present** | `components/chat/speech-player.tsx`, `lib/telemetry/speech.ts`, route integration. | Web uses committed assistant audio for audio responses, falls back to the speech endpoint for text-only/older messages, and exposes a manual action when browser autoplay is blocked. |
| Voice input | **Partial** | `lib/hooks/use-speech-to-text.ts`, chat route microphone control. | Browser speech recognition inserts text and can request an audio response. Permission-denied, microphone-unavailable, and transcription-failed are now distinct, recoverable errors (press-mic-again clears them, matching Omiro's retry pattern); see [chat.composer-error-recovery.md](decisions/chat.composer-error-recovery.md). Web still lacks — by design, not gap — Omiro's recording panel, native iOS transcription boundary, and LLM cleanup pass, since the browser Speech API has no recording file or intermediate draft needing one. |
| File attachments | **Present** | `lib/hooks/use-file-upload.ts`, chat route file input and attachment chips. | Upload, removal, and per-file retry (resubmits the exact failed file by identity, no re-selection) exist and are covered by focused tests; a second pick can't race an in-flight upload. See [chat.composer-error-recovery.md](decisions/chat.composer-error-recovery.md). |
| Referenced notes | **Present** | `useNoteSearch`, hashtag suggestions, selected-note chips, and `noteIds` send payload. | Web has note references, but not Omiro's rendered referenced-note presentation or chat-to-note ownership/link flows. |
| Reasoning display | **Present** | `ReasoningTrigger` toggle in `chat-message-body.tsx`; `chat-message.test.tsx` renders reasoning alongside failures and opt-in debug details. | Collapsed by default behind the toggle. |
| Tool-call rendering | **Present** | `components/ai-elements/tool.tsx`, route tool-call rendering. | Web renders pending/completed/rejected calls and previews. |
| Tool-call approval/rejection | **Present** | `lib/hooks/use-tool-call-respond.ts`, `ToolApprovalActions`. | Web has the client control Omiro currently lacks; response streaming is drained and queries invalidated rather than rendered incrementally. |
| Search within chat | **Present** | `lib/hooks/use-chat-message-search.ts`, `chat-message-search.tsx` (debounced, result count, empty-results state, display-list swapping), toolbar search entry in `chat-conversation-actions.tsx`; hook tests. | — |
| Response-length settings | **Present** | `lib/hooks/use-response-length.ts` (short/medium/long, persisted), `chat-response-settings.tsx`, menu entry in `chat-conversation-actions.tsx`, `responseLength` in the stream payload; tests. | — |
| Conversation debug mode | **Present** | Debug toggle in the conversation actions menu (`isDebugOpen` in `chat.$chatId.tsx`), `showDebug` rendering "Debug details" in `chat-message-status.tsx`; `chat-conversation-actions.test.tsx`, `chat-message.test.tsx`, stories. | Acceptance beyond toggle and details rendering unverified. |
| Archive from chat/inbox | **Present** | `useArchiveChat` in `hooks/use-chats.ts`, exposed from the detail actions menu and the chat list rows (`routes/chats.tsx`); archived route and settings page exist; hook and menu tests. | Optimistic list removal and post-archive routing unverified. |
| Archived chat list | **Present** | `hooks/use-account-settings.ts`, `components/account/settings-page.tsx`, `routes/settings.archived-chats.tsx`. | Web lists recent archived chats and links to them; restoration/unarchive behavior is absent in both clients' current inventory. |
| New chat from detail | **Partial** | Creation entries exist (`ChatNavigation`, `chat-start-button.tsx` creating with title `'New chat'`); missing-conversation recovery routes home (`onStartNewChat`). | No detail-toolbar new-chat action; no route-local pending behavior in `chat.$chatId.tsx`. |
| Automatic title update | **Present** | First accepted message normalizes the title via `getAutomaticChatTitle`, preserving custom titles (`currentChatTitle === 'New chat'` guard in `use-chat-composer-submission.ts`); `useUpdateChatTitle` hook with tests. | Creation still starts from the fixed `'New chat'` title until the first accept. |
| Chat-to-note transform | **Missing** | No chat transform action, draft builder, or note-draft route handoff was found. | Missing transcript extraction, empty-chat guard, truncation/title handling, and editable note handoff. |
| Chat task extraction/review | **Present** | `ChatTaskDialog` (extract via `api.tasks.extract`, review overlay with accept/reject/retry in `ChatTaskReview`, persist via `api.tasks.batch`, task-query invalidation) launched from the conversation actions menu; `chat-task-review.test.tsx`. | Omiro has the same flow without a dedicated acceptance flow, so parity meets the shared ceiling. |
| Linked note discussion flows | **Partial** | Web can seed a `noteId` query param and search/select notes in the composer. | Missing note-owned chat lifecycle, chat preview in the mixed inbox, summarize-to-note behavior, and linked navigation contract. |
| New-message entrance | **Implemented** | `chat-message.tsx`'s `AnimatePresence initial={isNewMessage}` gates entrance to a row's own first mount; `use-new-message-ids.ts` tracks which ids are genuinely new versus present when the chat loaded; `ChatConversation` is remounted per `chatId` (`key={chatId}` in `chat.$chatId.tsx`) so bookkeeping resets on chat switch. Reduced motion (`useReducedMotion` from `motion/react`) drops translate and keeps the opacity feedback. See [chat.design.md](chat.design.md#web-parity). | No dedicated motion unit test or browser-level acceptance flow found yet. |
| Offline state | **Present** | `useOnlineStatus` hook with tests; send/retry gated on online; offline messaging with draft-and-attachment preservation in the composer ("You are offline. Your draft and attachments are preserved."), home page, and chat load error; `Offline` story. | Browser `onLine`-based; no NetInfo equivalent needed on web. |
| Query persistence/restoration | **Partial** | React Router loader seeds initial messages and React Query caches them. Composer draft/attachment persistence is implemented (`use-chat-composer-state.ts`, `localStorage` keyed `chat-composer:<chatId>`, restored via lazy `useState` init and reset per chat via `key={chatId}` on `ChatComposerPanel`). Restored-versus-initial loading semantics are implemented (`compute-chat-load-state.ts`: `initial` vs. `ready`+`isRestoring` vs. `not-found`/`error`). | Missing Omiro's persisted query-state handling equivalent and a resume-scroll/focus target after restoring a draft. |
| Chat accessibility/test IDs | **Partial** | Web uses semantic controls and labeled chat actions; chat-specific flow tests exist (`tests/e2e/chat-playbook.spec.ts`: `SEND`/`TOOL`/`RECOVER`/`LAUNCH`/`UI` suites) plus focused hook/component suites. | Omiro-specific test IDs are not mirrored; per-row a11y acceptance lives with the verification tasks. |

### Missing web ownership by subsystem

#### Entry and navigation

The web currently separates chat navigation from the rest of the product:

- `components/chat-navigation.tsx` owns new-chat creation and a recent-chat
  dropdown.
- `routes/chats.tsx` owns a paginated chat-only list.
- `routes/home.tsx` redirects to a chat rather than owning a mixed capture
  surface.
- `routes/chat/chat.$chatId.tsx` owns the entire detail UI and most local state.

To reach Omiro parity, the missing web seams are a shared mixed composer,
mixed inbox adapter, note/chat submission ownership, resume state, and a
detail-level action surface.

#### Message lifecycle

The web has separate stream (`use-stream-message.ts`), regenerate
(`use-regenerate-message.ts`), edit (`use-chat-message-edit.ts`), message
mutation (`use-chat-messages.ts` with a real `deleteMessage`), and archive
(`useArchiveChat`) services, all with focused tests. The former no-op
placeholders are real mutations now; the highest-risk remaining gap is
chat-to-note, which has no web owner.

#### Conversation actions

The detail toolbar owns a chat action menu (`chat-conversation-actions.tsx`:
search, extract tasks, response settings, debug, archive). Search, response
length, debug, auto-title, archive, and task extraction all have web owners
now; note transformation (chat-to-note) is the one without.

#### Shared composer capabilities

Web has file upload and browser speech-to-text, implemented as detail-local
controls with local draft persistence (`use-chat-composer-state.ts`). They do
not share Omiro's composer controller model for attachment lifecycle, voice
cleanup, or mixed chat/note submission.

### Verification gap

The web test inventory now spans the e2e playbook plus focused suites:

- `tests/e2e/chat-playbook.spec.ts`: `SEND-01..05`, `TOOL-01..04`,
  `RECOVER-01..06`, `LAUNCH-01..04`, `UI-01..09`.
- Focused suites: `use-chat-messages` (not-found, retry, delete paths;
  plus MSW and `compute-chat-load-state` suites), `use-stream-message`
  (abort signal, server cancel, durable cancelled state),
  `use-regenerate-message`, `use-chat-composer-submission` (retry as a
  separate action), `use-chat-composer-state`, `use-chat-message-search`,
  `use-response-length`, `use-chats` (archive, title), `use-online-status`,
  `chat-message` (reasoning, failures, debug details),
  `chat-conversation-actions` (debug toggle, archive), `chat-task-review`,
  `use-file-upload.lifecycle`, `use-speech-to-text`, `chat-composer`,
  `chat-start-button`, `speech-player`, and speech telemetry.

Treat as still unverified even where code is present:

- chat-to-note and mixed-inbox flows (unimplemented on web);
- archived-chat navigation with active-list removal at e2e level;
- large-message scrolling;
- debug-mode acceptance beyond the toggle and details rendering.

### Recommended implementation order

Already complete from the previous order: real message mutations with
explicit stream error/cancellation state and draft preservation on failure;
the detail action surface except chat-to-note; task extraction and review.
Remaining work, in order:

1. Build the chat-to-note transform and linked note discussion behavior —
   the last creation flows with no web owner.
2. Build the mixed All/inbox composer and list adapter so chat creation,
   notes, drafts, and navigation follow one product entry model.
3. Add acceptance for debug mode, archived-chat navigation/removal, and
   large-message scrolling.
4. Reconcile any remaining voice, audio response, motion, and offline
   leftovers against the corrected matrix.
