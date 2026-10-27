import { createHash, randomBytes } from 'node:crypto';

import { db } from '@hominem/db/core';
import { MessagingRepository } from '@hominem/db/messaging';

const hashCode = (value: string) => createHash('sha256').update(value).digest('hex');

export function createTelegramLinkService(input: {
  ownerUserId: string;
  botUsername: string;
  botToken: string;
}) {
  const isOwner = (userId: string) => Boolean(input.ownerUserId) && userId === input.ownerUserId;

  return {
    isOwner,
    status: async (userId: string) => {
      if (!isOwner(userId)) return null;
      const identity = await MessagingRepository.getActiveForOwner(db, userId);
      return { connected: Boolean(identity), channel: 'telegram' as const };
    },
    createLink: async (userId: string) => {
      if (!isOwner(userId) || !input.botUsername || !input.botToken) return null;
      const existing = await MessagingRepository.getActiveForOwner(db, userId);
      if (existing) return { connected: true as const };
      const code = randomBytes(32).toString('base64url');
      await MessagingRepository.createLinkCode(db, {
        ownerUserId: userId,
        codeHash: hashCode(code),
      });
      const username = input.botUsername.replace(/^@/, '');
      return {
        connected: false as const,
        url: `https://t.me/${username}?start=${encodeURIComponent(code)}`,
      };
    },
    consumeLink: (code: string, telegramUserId: string, telegramChatId: string) =>
      MessagingRepository.consumeLinkCode({
        codeHash: hashCode(code),
        externalUserId: telegramUserId,
        externalChatId: telegramChatId,
        expectedOwnerUserId: input.ownerUserId,
      }),
    unlink: async (userId: string) => {
      if (!isOwner(userId)) return false;
      await MessagingRepository.revokeForOwner(db, userId);
      return true;
    },
  };
}
