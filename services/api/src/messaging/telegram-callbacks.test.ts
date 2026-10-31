import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redis } = vi.hoisted(() => ({
  redis: {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@hominem/services/redis', () => ({ redis }));

import { deleteConfirmationToken, getConfirmationToken } from './telegram-callbacks';

describe('Telegram confirmation tokens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the action without consuming it so queue retries can reuse it', async () => {
    const action = {
      approved: true,
      userId: 'user-1',
      chatId: 'chat-1',
      messageId: 'message-1',
      toolCallId: 'call-1',
    };
    redis.get.mockResolvedValue(JSON.stringify(action));

    await expect(getConfirmationToken('token-1')).resolves.toEqual(action);

    expect(redis.get).toHaveBeenCalledWith('telegram:confirm:token-1');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('deletes the action after successful processing', async () => {
    await deleteConfirmationToken('token-1');

    expect(redis.del).toHaveBeenCalledWith('telegram:confirm:token-1');
  });
});
