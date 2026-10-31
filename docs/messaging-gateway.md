# Messaging gateway

Status: Telegram private text chat is implemented. Production configuration, webhook registration,
deployment, and the owner's first link remain to be done. Voice, attachments, groups, proactive
messages, and WhatsApp are future work.

## Architecture

Telegram does not speak MCP. The bot calls Hominem's chat generation service directly; that service
plans and invokes the existing registered Hominem tools and preserves tool confirmation rules.
Telegram has its own Hominem chat history.

```text
Telegram
  -> POST /api/telegram/webhook (secret header, private-chat and owner checks)
  -> BullMQ messaging-inbound (dedupe by update_id)
  -> worker (link validation, chat generation, tool confirmations)
  -> Telegram Bot API
```

The webhook validates `X-Telegram-Bot-Api-Secret-Token`, ignores groups and channels, verifies the
linked Telegram identity for ordinary messages and confirmation taps, enqueues the update, and
returns. The worker calls `chatGenerationService` in-process. It never calls the API over HTTP.

## Owner access

`TELEGRAM_OWNER_USER_ID` is required. The signed-in connection route only creates a link for that
Hominem account. It returns a 256-bit, ten-minute, single-use deep-link code; only its hash is
stored. Consuming the code creates a separate Telegram chat and binds the Telegram numeric user id
and private chat id to the configured Hominem owner. A partial unique index allows one active
Telegram identity per Hominem user and one active Hominem owner per Telegram user.

The webhook and worker both reject messages unless the linked owner id matches
`TELEGRAM_OWNER_USER_ID`, the Telegram sender id matches the stored identity, and the private chat
id matches. Group and channel updates are ignored. `/unlink` revokes the identity; the Hominem chat
history remains in the account.

The linked owner can use the chat engine's full enabled capability catalog, including sensitive
data and writes. Tool calls that require confirmation pause the generation. Telegram sends an
approve/reject keyboard whose random callback tokens expire after 24 hours and are single-use; a
valid callback resumes the same generation through `respondToConfirmation`.

## Current behavior

- Private text messages go to `chatGenerationService.sendMessage` with a deterministic generation
  id derived from Telegram's `update_id`, preventing duplicate generation on webhook retries.
- The worker drains durable generation events and sends the final assistant text. Long responses
  split at paragraph boundaries and then at Unicode characters to respect Telegram's 4096-character
  message limit.
- Tool confirmations show the tool name and prepared preview with Approve and Reject buttons.
- `/start <code>` links the account; `/unlink` revokes the link. Unknown users and invalid codes
  receive no account data.
- Inbound updates are queued with bounded retry/retention and rate-limited per Telegram sender.

Voice and media are not supported in this MVP. The current API has no general chat transcription
operation for Telegram to call.

## Setup and activation

Configure the following on both `hominem-api` and `hominem-worker` in Fly:

- `TELEGRAM_BOT_TOKEN` — BotFather token; keep secret.
- `TELEGRAM_BOT_USERNAME` — public bot username.
- `TELEGRAM_OWNER_USER_ID` — the owner's Hominem account id.
- `TELEGRAM_WEBHOOK_SECRET` — random webhook secret; the API uses it to authenticate updates.

Then deploy the API, worker, and database migration. Run
`pnpm --filter @hominem/api telegram:set-webhook` with production `API_URL` and the Telegram
settings above. In the signed-in Omiro settings screen, connect Telegram and follow the bot's
`/start` link. The setup screen displays the signed-in account id to copy into
`TELEGRAM_OWNER_USER_ID` before deployment.

The Telegram bot token authorizes a caller to control the bot, so never paste it into source,
logs, or chat. Telegram bot conversations are not Secret Chats; Telegram processes the messages
sent through the Bot API. The link screen should disclose that the owner has enabled the bot for
full account access.

## Future work

- Voice notes and attachments, with an explicit media download and transcription path.
- Proactive messages with user-configurable quiet hours and delivery preferences.
- WhatsApp adapter, Meta policy review, business verification, and the 24-hour delivery window.
