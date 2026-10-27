import { randomBytes } from 'node:crypto';

import { redis } from '@hominem/services/redis';
import { z } from 'zod';

export interface TelegramConfirmationAction {
  approved: boolean;
  userId: string;
  chatId: string;
  messageId: string;
  toolCallId: string;
}

const keyFor = (token: string) => `telegram:confirm:${token}`;
const confirmationActionSchema = z.object({
  approved: z.boolean(),
  userId: z.string(),
  chatId: z.string(),
  messageId: z.string(),
  toolCallId: z.string(),
});
const consumeScript = `
  local value = redis.call('GET', KEYS[1])
  if value then redis.call('DEL', KEYS[1]) end
  return value
`;

export async function createConfirmationTokens(
  input: Omit<TelegramConfirmationAction, 'approved'>,
) {
  const entries = await Promise.all(
    [true, false].map(async (approved) => {
      const token = randomBytes(16).toString('base64url');
      const action: TelegramConfirmationAction = { ...input, approved };
      await redis.set(keyFor(token), JSON.stringify(action), 'EX', 60 * 60 * 24, 'NX');
      return { approved, token };
    }),
  );
  const [approved, rejected] = entries;
  return { true: approved.token, false: rejected.token };
}

export async function consumeConfirmationToken(
  token: string,
): Promise<TelegramConfirmationAction | null> {
  const value = await redis.eval(consumeScript, 1, keyFor(token));
  if (typeof value !== 'string') return null;
  try {
    const parsed = confirmationActionSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
