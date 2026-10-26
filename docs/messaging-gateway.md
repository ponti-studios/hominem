# Messaging gateway (Telegram first, WhatsApp second)

Status: sketch, nothing built yet. Written so we can poke holes before touching code.

## Why

We don't want to own a chat UI forever. People already live in Telegram/WhatsApp, so let them
talk to hominem there. The web/omiro chat stays for the rich stuff (finance review, editing).

Quick correction to the obvious idea: WhatsApp and Telegram don't speak MCP. MCP is for clients
like Claude. What we already have that matters is the **chat generation engine**
(`chat/chat-generation.service.ts` + `mcp/chat-tool-adapter.ts`), which runs the LLM, picks
tools, and handles write confirmations. The gateway is a thin pipe into that engine.

## Shape

```
Telegram / WhatsApp
      │ webhook (signed)
      ▼
services/api/src/messaging/
  routes.ts            Hono routes, one per channel, verify signature, 200 fast
  gateway.ts           channel-agnostic core (below)
  link.service.ts      phone/chat id <-> user linking
  channels/
    types.ts           MessagingChannel interface
    telegram.ts
    whatsapp.ts
      │ enqueue (BullMQ)
      ▼
services/api/src/workers/messaging-inbound.ts   (does the slow LLM work)
      │ in-process calls, NEVER HTTP back to the API
      ▼
chatGenerationService.sendMessage / respondToConfirmation
```

Webhook handlers must ack fast (Telegram retries, Meta retries and eventually disables
the webhook). So: verify, dedupe, enqueue, return 200. The worker does the generation. The
worker calls the service directly (worker/API boundary rule).

## Channel interface

```ts
type ChannelId = 'telegram' | 'whatsapp';

type InboundMessage =
  | { kind: 'text'; text: string }
  | { kind: 'voice'; mediaRef: string }          // transcribed via chat-speech.service
  | { kind: 'confirm'; toolCallId: string; approved: boolean } // button tap
  | { kind: 'unsupported'; what: string };

type Inbound = {
  channel: ChannelId;
  externalUserId: string;   // telegram user id / wa_id (E.164 digits)
  externalMessageId: string; // for dedupe
  receivedAt: Date;
  message: InboundMessage;
};

interface MessagingChannel {
  id: ChannelId;
  verifyAndParse(req: Request): Promise<Inbound[]>;      // sig check + normalize
  fetchMedia(ref: string): Promise<{ bytes: Uint8Array; mime: string }>;
  sendText(to: string, text: string): Promise<void>;    // splits to channel limit
  sendConfirm(to: string, prompt: string, toolCallId: string): Promise<void>; // buttons
  typing(to: string): Promise<void>;
  canSendFreeForm(to: string): Promise<boolean>;         // WA 24h window; TG always true
}
```

`gateway.handle(inbound)`:

1. Dedupe on `(channel, externalMessageId)` (Redis SETNX, ~24h TTL).
2. Resolve `externalUserId` -> `userId` via `link.service`. Unlinked? Only a "link your account"
   reply goes out, and the link code path is the only thing that runs.
3. Rate limit per user (reuse `mcp/rate-limiter`).
4. Get-or-create the user's single channel chat (one long-running chat per user per channel).
5. Voice -> transcribe -> treat as text.
6. `sendMessage({ userId, chatId, generationId, message, fileIds: [] , responseLength: 'short' })`.
7. Drain the event iterable to the terminal event. Final assistant text -> `sendText`.
   If the run ends on a pending tool confirmation -> `sendConfirm` with the preview, and a later
   `confirm` inbound calls `respondToConfirmation`.
8. Typing indicator while it's running (Telegram `sendChatAction`, refreshed ~every 4s).

`generationId` = deterministic from `(channel, externalMessageId)` so a webhook retry is
idempotent through the engine's existing replay path.

## Data

New tables (goose migration, per `hominem-database` skill):

- `messaging_identities`: `id`, `user_id`, `channel`, `external_user_id`, `chat_id`,
  `linked_at`, `last_inbound_at` (drives the WA 24h window), `revoked_at`.
  Unique on `(channel, external_user_id)` where `revoked_at is null`.
- `messaging_link_codes`: `code_hash`, `user_id`, `channel`, `expires_at` (10 min), `used_at`.

Store codes hashed, same as `hmt_` tokens in `mcp-tokens.service.ts`.

## Linking

Signed-in user hits "Connect Telegram/WhatsApp" in the app -> we mint a code and show a deep link:

- Telegram: `https://t.me/<bot>?start=<code>` -> bot gets `/start <code>` automatically. One tap.
- WhatsApp: `https://wa.me/<number>?text=<code>` -> user sends the prefilled message.

Webhook sees the code, binds `externalUserId` to `userId`, replies "you're in". Codes are single
use. Unlink from the app (and a `STOP` command) sets `revoked_at`.

## Tool scope on messaging channels (needs a real change)

As far as I read, scope checks (`scopes.ts`, `mcp/routes.ts`) only gate the MCP endpoint. The chat
engine picks from the whole registry via `planChatTools`. So channel restrictions need a new
filter: `planChatTools({ ..., allowedCapabilities })`, fed from a per-channel allowlist.

Proposed default for messaging channels: `task`, `notes`, `memory` read/write, plus read-only
lookups. **No** finance writes, no deletes, no web search, no open-ended chat on WhatsApp
(that last one is the Meta policy risk, see below). Destructive stuff always goes through the
button confirmation. A phone number is a weaker identity than a session (SIM swap), so keep
the blast radius small.

## Telegram specifics (phase 1)

- Create bot with BotFather. `setWebhook` with `secret_token`; verify the
  `X-Telegram-Bot-Api-Secret-Token` header. HTTPS only.
- Inbound: `message` (text, voice) and `callback_query` (button taps).
- Outbound: `sendMessage`, `editMessageText`, inline keyboard for confirms, `sendChatAction`.
- Limit 4096 chars per message; split on paragraph boundaries.
- Optional nicety: stream by editing one message (about 1 edit/sec/chat to stay inside rate
  limits). Skip in v1, just send the final text, then try it.
- Free, no review, no 24h window, no AI-provider policy. Good place to prove the idea.

## WhatsApp specifics (phase 2)

- Meta app + WABA + business verification + dedicated number. Dev against Meta's test number first.
- Webhook: GET verify challenge, POST with `X-Hub-Signature-256` (HMAC-SHA256 of raw body with
  app secret). Verify on the raw bytes, before JSON parsing.
- Inbound: text, audio (voice notes), `interactive.button_reply`.
- Outbound: free-form only inside 24h of `last_inbound_at`. Outside it we need approved templates
  (reminders, "your task is due"). `canSendFreeForm` guards every send; out of window with no
  template -> drop + log, never throw.
- Reply buttons max 3. Confirm = Yes / No (/ Edit later).
- No streaming. Final message only. 4096 char text limit, split like Telegram.
- Cost: replies beyond the first 1,000 free per business number per month are billed since
  2026-10-01. Meter it per user next to `ai-usage.service` so credit/limits can account for it.
  Rates here are from third-party blogs, confirm on Meta's rate card.
- **Policy risk:** since 2026-01-15 Meta's terms bar "AI Providers" whose main offering is a
  general-purpose assistant. Keep the WA surface structured (capture + query own data), no
  open-ended Q&A. Read the actual clause (Section 4.7 per one source) before launch; I only saw
  secondary sources. Meta decides what counts, so there's no guarantee.
- Don't use Baileys/whatsapp-web.js. ToS violation, numbers get banned.

## Privacy

Messages on both channels transit the provider in a form they can read (Telegram bot chats aren't
E2E; WhatsApp Cloud API is processed by Meta). Keep finance/health content off these channels by
default via the allowlist above. Say so in the link screen.

## Phasing

1. `messaging_*` migration, `link.service`, channel interface, gateway, worker. Fake channel in
   tests (like the scripted chat provider) to cover dedupe, unlinked, confirm, retry.
2. Telegram adapter + link flow in web settings. Dogfood.
3. `allowedCapabilities` filter in the planner, with tests.
4. WhatsApp adapter on the test number. Window handling + one template (e.g. daily summary).
5. Policy read-through, business verification, go/no-go on WhatsApp.

## Open questions

- One chat per user per channel, or share one chat across channels so web/omiro/Telegram see the
  same thread? Sharing is cooler, but history gets long and tool-heavy. Leaning separate to start.
- Group chats: ignore in v1 (private chats only).
- Proactive messages (reminders): which worker triggers them, and does it respect quiet hours?
- Do we meter messaging replies against the existing credit system?
