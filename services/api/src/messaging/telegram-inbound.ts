import { createHash } from 'node:crypto';

import type { GenerationEvent } from '@hominem/chat';
import { db } from '@hominem/db/core';
import { MessagingRepository } from '@hominem/db/messaging';
import { logger } from '@hominem/telemetry';

import { chatGenerationService } from '../chat/chat-generation.service';
import { env } from '../env';
import { createTelegramLinkService } from './link.service';
import { createTelegramClient, telegramUpdateSchema, type TelegramUpdate } from './telegram';
import {
  createConfirmationTokens,
  deleteConfirmationToken,
  getConfirmationToken,
} from './telegram-callbacks';

const bot = createTelegramClient({ botToken: env.TELEGRAM_BOT_TOKEN });
const linkService = createTelegramLinkService({
  ownerUserId: env.TELEGRAM_OWNER_USER_ID,
  botUsername: env.TELEGRAM_BOT_USERNAME,
  botToken: env.TELEGRAM_BOT_TOKEN,
});

function deterministicGenerationId(updateId: number) {
  const bytes = createHash('sha256').update(`telegram:${updateId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isOwnerIdentity(
  identity: { ownerUserId: string; externalChatId: string },
  telegramChatId: string,
) {
  return (
    Boolean(env.TELEGRAM_OWNER_USER_ID) &&
    identity.ownerUserId === env.TELEGRAM_OWNER_USER_ID &&
    identity.externalChatId === telegramChatId
  );
}

function getStartCode(text: string | undefined) {
  const match = text?.trim().match(/^\/start(?:@[a-z0-9_]+)?(?:\s+([A-Za-z0-9_-]{20,64}))?$/i);
  return match?.[1] ?? null;
}

function stringifyPreview(value: unknown) {
  if (value === null || value === undefined) return '';
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized.length > 2500 ? `${serialized.slice(0, 2500)}…` : serialized;
  } catch {
    return '';
  }
}

async function sendConfirmation(
  chatId: string,
  input: {
    userId: string;
    chatId: string;
    messageId: string;
    toolCallId: string;
    name: string;
    preview: unknown;
  },
) {
  const tokens = await createConfirmationTokens({
    userId: input.userId,
    chatId: input.chatId,
    messageId: input.messageId,
    toolCallId: input.toolCallId,
  });
  const details = stringifyPreview(input.preview);
  const text = [`Hominem wants to run: ${input.name}`, details, 'Approve this action?']
    .filter(Boolean)
    .join('\n\n');
  await bot.sendText(chatId, text, {
    inline_keyboard: [
      [
        { text: 'Approve', callback_data: `c:${tokens.true}` },
        { text: 'Reject', callback_data: `c:${tokens.false}` },
      ],
    ],
  });
}

async function drainGeneration(events: AsyncIterable<GenerationEvent>) {
  let committedText: string | null = null;
  let checkpoint: {
    messageId: string;
    call: { id: string; name: string; preview?: unknown };
  } | null = null;
  let failure: string | null = null;
  for await (const event of events) {
    if (event.type === 'generation.committed') committedText = event.payload.message.content;
    if (event.type === 'generation.failed') failure = event.payload.message;
    if (event.type === 'generation.checkpointed') {
      const callId = event.payload.checkpoint.pendingToolCallIds[0];
      if (callId)
        checkpoint = {
          messageId: event.payload.checkpoint.assistantMessage.id,
          call: {
            id: callId,
            name:
              event.payload.checkpoint.assistantMessage.toolCalls?.find(
                (tool) => tool.toolCallId === callId,
              )?.toolName ?? 'requested action',
            preview: event.payload.checkpoint.assistantMessage.toolCalls?.find(
              (tool) => tool.toolCallId === callId,
            )?.preview,
          },
        };
    }
  }
  return { committedText, checkpoint, failure };
}

async function deliverGeneration(
  chatId: string,
  result: Awaited<ReturnType<typeof drainGeneration>>,
  ownerUserId: string,
  hominemChatId: string,
) {
  if (result.checkpoint) {
    await sendConfirmation(chatId, {
      userId: ownerUserId,
      chatId: hominemChatId,
      messageId: result.checkpoint.messageId,
      toolCallId: result.checkpoint.call.id,
      name: result.checkpoint.call.name,
      preview: result.checkpoint.call.preview,
    });
    return;
  }
  await bot.sendText(
    chatId,
    result.committedText ?? result.failure ?? 'I could not complete that request.',
  );
}

async function processMessage(updateId: number, update: TelegramUpdate) {
  const message = update.message;
  if (!message || !message.from || message.chat.type !== 'private') return;
  const telegramUserId = String(message.from.id);
  const telegramChatId = String(message.chat.id);
  const text = message.text?.trim() ?? '';

  if (text.startsWith('/start')) {
    const code = getStartCode(text);
    if (!code || !env.TELEGRAM_OWNER_USER_ID) return;
    const identity = await linkService.consumeLink(code, telegramUserId, telegramChatId);
    if (identity && isOwnerIdentity(identity, telegramChatId)) {
      await bot.sendText(
        telegramChatId,
        'Telegram is linked to your Hominem account. You can start chatting here.',
      );
    }
    return;
  }

  const identity = await MessagingRepository.getActiveForTelegramUser(db, telegramUserId);
  if (!identity || !isOwnerIdentity(identity, telegramChatId)) return;
  await MessagingRepository.markInbound(db, identity.id);

  if (/^\/unlink(?:@[a-z0-9_]+)?$/i.test(text)) {
    await MessagingRepository.revokeForOwner(db, identity.ownerUserId);
    await bot.sendText(telegramChatId, 'Telegram has been unlinked from your Hominem account.');
    return;
  }

  if (!text || text.startsWith('/')) {
    await bot.sendText(
      telegramChatId,
      text
        ? 'I support private text chat. Send a message to continue.'
        : 'I can only process text messages right now.',
    );
    return;
  }

  const generationId = deterministicGenerationId(updateId);
  const events = await chatGenerationService.sendMessage({
    userId: identity.ownerUserId,
    chatId: identity.chatId,
    generationId,
    message: text,
    fileIds: [],
    responseLength: 'short',
  });
  const result = await drainGeneration(events);
  await deliverGeneration(telegramChatId, result, identity.ownerUserId, identity.chatId);
}

async function processCallback(update: TelegramUpdate) {
  const callback = update.callback_query;
  const callbackData = callback?.data;
  const message = callback?.message;
  if (!callback || !message || message.chat.type !== 'private' || !callbackData?.startsWith('c:'))
    return;

  const telegramUserId = String(callback.from.id);
  const telegramChatId = String(message.chat.id);
  const identity = await MessagingRepository.getActiveForTelegramUser(db, telegramUserId);
  if (!identity || !isOwnerIdentity(identity, telegramChatId)) {
    await bot.answerCallback(callback.id, 'This bot is private.');
    return;
  }

  const confirmationToken = callbackData.slice(2);
  const action = await getConfirmationToken(confirmationToken);
  if (!action || action.userId !== identity.ownerUserId || action.chatId !== identity.chatId) {
    await bot.answerCallback(callback.id, 'This confirmation has expired.');
    return;
  }

  await bot.answerCallback(callback.id, action.approved ? 'Approved.' : 'Rejected.');
  const events = await chatGenerationService.respondToConfirmation({
    userId: identity.ownerUserId,
    chatId: action.chatId,
    messageId: action.messageId,
    toolCallId: action.toolCallId,
    approved: action.approved,
    responseLength: 'short',
  });
  const result = await drainGeneration(events);
  await deliverGeneration(telegramChatId, result, identity.ownerUserId, identity.chatId);
  await deleteConfirmationToken(confirmationToken);
}

export async function processTelegramUpdate(raw: unknown, updateId: number) {
  const parsed = telegramUpdateSchema.safeParse(raw);
  if (!parsed.success || parsed.data.update_id !== updateId) {
    throw new Error('InvalidTelegramQueuePayload');
  }
  try {
    if (parsed.data.callback_query) await processCallback(parsed.data);
    else await processMessage(updateId, parsed.data);
  } catch (error) {
    logger.error('telegram_update_processing_failed', {
      updateId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
}
