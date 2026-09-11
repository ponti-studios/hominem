# Omiro chat

This document describes the current chat implementation in Omiro. Generation
and message persistence are shared with the Hominem chat package; the mobile
app owns native presentation, local drafts, and interaction state.

## Entry points

- `/(protected)/stream` shows chat rows alongside notes. Its `Chats` filter
  narrows the mixed Stream without creating a second content model.
- `/(protected)/new-chat` starts a conversation from an empty composer. A
  `seed` route parameter can prefill the composer.
- `/(protected)/chats/[id]` renders a persisted conversation and its composer.
- `/(protected)/chats/archived` shows archived conversations.

Starting a chat calls `useStartChat`. The server accepts the generation and
returns a chat ID before the assistant response is committed. Omiro navigates
to the chat after the accepted event, seeds the user message in the query
cache, and reconciles the chat and Stream queries.

## Composer behavior

The shared `Composer` has two modes:

- `inbox` mode creates a note or starts a chat. The entry mode can be mixed,
  note, or chat. In mixed mode, a single-line ordinary message is inferred as
  a chat; multiline or structured text is inferred as a note.
- `chat` mode sends a message to an existing chat and owns the chat draft.

The Stream/New Chat composer persists its draft through `launch-state.ts`.
Chat detail drafts are keyed by chat ID. A successful submission clears the
appropriate draft; a failed submission preserves recoverable text. Attachments
are uploaded through the file service and passed as file IDs to generation.

## Generation lifecycle

The mobile client uses `ChatClient` with the XHR transport and durable event
checkpoints. A generation has these observable stages:

```text
preparing -> running -> awaiting_confirmation -> saving -> committed
                         |                  |
                         +-> failed        +-> cancelled
                         +-> stopping -----> cancelled
```

Not every generation visits every stage. The activity surface renders the
current stage, a stop action while active, and a retry action for failed or
cancelled generations. The assistant message is inserted when the server sends
the committed event; intermediate lifecycle events do not become transcript
messages.

Cancellation calls the server, cancels the client controller, and marks the
generation cancelled. The chat screen owns one send mutation and shares it
with message-list retry actions so send and retry cannot race separate
controllers. New generation requests are rejected while offline rather than
silently queued.

## Message actions

Chat detail currently supports editing, retrying failed generations,
regenerating assistant responses, stopping active generations, searching loaded
messages, copying and sharing content, viewing sources and settings, responding
to approval-required tool calls, archiving, and transforming supported content
into a note or task review flow.

The action menu and message list are presentation boundaries. Query and
mutation ownership remains in `services/chat/`; React-independent chat logic
belongs there or in directly tested service helpers, not in one replacement
controller hook.

## Rendering and motion rules

Historical messages are static when a chat opens. New-message and generation
motion must not block reading, typing, scrolling, or recovery. Active generation
copy is shown in the activity surface; readable assistant text is rendered as
soon as committed message data is available. Auto-scroll follows active output
only while the reader is already at the bottom.

Reduced Motion changes transition behavior through the app motion hooks and
protected Stack configuration. It does not remove state communication or make
active generation controls unavailable.

## Testing references

Chat coverage is under `apps/omiro/tests/services/chat/`,
`apps/omiro/tests/hooks/`, and `apps/omiro/tests/components/chat/`. Maestro
coverage is under `apps/omiro/tests/flows/chat-*.yaml` and
`apps/omiro/tests/e2e/chat-playbook.yaml`. Use `testID` selectors for modal and
sheet controls because iOS accessibility merging makes fuzzy text selectors
unreliable in those surfaces.
