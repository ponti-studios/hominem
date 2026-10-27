import type { Selectable } from 'kysely';

import { runInTransaction, type DbHandle } from '../../transaction';
import type { AppMessagingIdentities } from '../../types/database';
import { ChatRepository } from '../chats/chat.repository';

type IdentityRow = Selectable<AppMessagingIdentities>;

export interface MessagingIdentityRecord {
  id: string;
  ownerUserId: string;
  channel: 'telegram';
  externalUserId: string;
  externalChatId: string;
  chatId: string;
  linkedAt: string;
  lastInboundAt: string | null;
}

function toIdentityRecord(row: IdentityRow): MessagingIdentityRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    channel: 'telegram',
    externalUserId: row.externalUserId,
    externalChatId: row.externalChatId,
    chatId: row.chatId,
    linkedAt: new Date(row.linkedAt).toISOString(),
    lastInboundAt: row.lastInboundAt ? new Date(row.lastInboundAt).toISOString() : null,
  };
}

export const MessagingRepository = {
  async getActiveForOwner(handle: DbHandle, ownerUserId: string) {
    const row = await handle
      .selectFrom('app.messagingIdentities')
      .selectAll()
      .where('ownerUserId', '=', ownerUserId)
      .where('channel', '=', 'telegram')
      .where('revokedAt', 'is', null)
      .executeTakeFirst();
    return row ? toIdentityRecord(row) : null;
  },

  async getActiveForTelegramUser(handle: DbHandle, externalUserId: string) {
    const row = await handle
      .selectFrom('app.messagingIdentities')
      .selectAll()
      .where('channel', '=', 'telegram')
      .where('externalUserId', '=', externalUserId)
      .where('revokedAt', 'is', null)
      .executeTakeFirst();
    return row ? toIdentityRecord(row) : null;
  },

  async createLinkCode(handle: DbHandle, input: { ownerUserId: string; codeHash: string }) {
    await handle
      .deleteFrom('app.messagingLinkCodes')
      .where('ownerUserId', '=', input.ownerUserId)
      .where('channel', '=', 'telegram')
      .where('usedAt', 'is', null)
      .execute();

    await handle
      .insertInto('app.messagingLinkCodes')
      .values({
        ownerUserId: input.ownerUserId,
        channel: 'telegram',
        codeHash: input.codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .executeTakeFirstOrThrow();
  },

  async consumeLinkCode(input: {
    codeHash: string;
    externalUserId: string;
    externalChatId: string;
    expectedOwnerUserId: string;
  }): Promise<MessagingIdentityRecord | null> {
    return runInTransaction(async (trx) => {
      const code = await trx
        .selectFrom('app.messagingLinkCodes')
        .selectAll()
        .where('codeHash', '=', input.codeHash)
        .where('channel', '=', 'telegram')
        .where('usedAt', 'is', null)
        .where('expiresAt', '>', new Date().toISOString())
        .forUpdate()
        .executeTakeFirst();
      if (!code || code.ownerUserId !== input.expectedOwnerUserId) return null;

      const [existingTelegram, existingOwner] = await Promise.all([
        trx
          .selectFrom('app.messagingIdentities')
          .select('id')
          .where('channel', '=', 'telegram')
          .where('externalUserId', '=', input.externalUserId)
          .where('revokedAt', 'is', null)
          .executeTakeFirst(),
        trx
          .selectFrom('app.messagingIdentities')
          .select('id')
          .where('ownerUserId', '=', code.ownerUserId)
          .where('channel', '=', 'telegram')
          .where('revokedAt', 'is', null)
          .executeTakeFirst(),
      ]);
      if (existingTelegram || existingOwner) return null;

      const consumed = await trx
        .updateTable('app.messagingLinkCodes')
        .set({ usedAt: new Date().toISOString() })
        .where('id', '=', code.id)
        .where('usedAt', 'is', null)
        .returning('id')
        .executeTakeFirst();
      if (!consumed) return null;

      const chat = await ChatRepository.create(trx, {
        userId: code.ownerUserId,
        title: 'Telegram',
      });
      const identity = await trx
        .insertInto('app.messagingIdentities')
        .values({
          ownerUserId: code.ownerUserId,
          channel: 'telegram',
          externalUserId: input.externalUserId,
          externalChatId: input.externalChatId,
          chatId: chat.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toIdentityRecord(identity);
    });
  },

  async markInbound(handle: DbHandle, identityId: string) {
    await handle
      .updateTable('app.messagingIdentities')
      .set({ lastInboundAt: new Date().toISOString() })
      .where('id', '=', identityId)
      .where('revokedAt', 'is', null)
      .execute();
  },

  async revokeForOwner(handle: DbHandle, ownerUserId: string) {
    await handle
      .updateTable('app.messagingIdentities')
      .set({ revokedAt: new Date().toISOString() })
      .where('ownerUserId', '=', ownerUserId)
      .where('channel', '=', 'telegram')
      .where('revokedAt', 'is', null)
      .execute();
    await handle
      .deleteFrom('app.messagingLinkCodes')
      .where('ownerUserId', '=', ownerUserId)
      .where('channel', '=', 'telegram')
      .where('usedAt', 'is', null)
      .execute();
  },
};
