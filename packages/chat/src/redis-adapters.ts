import type { GenerationEffectStore } from './generation-machine';
import { toolResultSchema } from './generation-schemas';

export type ChatRedis = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: 'EX', ttlSeconds: number) => Promise<unknown>;
};

export function createRedisChatEffectStore(
  redis: ChatRedis,
  options: { keyPrefix?: string; ttlSeconds?: number } = {},
): GenerationEffectStore {
  const keyPrefix = options.keyPrefix ?? 'chat:effect:';
  const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 24 * 30;
  const key = (input: { generationId: string; idempotencyKey: string; toolName: string }) =>
    `${keyPrefix}${input.generationId}:${input.idempotencyKey}:${input.toolName}`;

  return {
    get: async (input) => {
      const value = await redis.get(key(input));
      if (!value) return null;
      try {
        const parsed = toolResultSchema.safeParse(JSON.parse(value));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    save: async (input) => {
      await redis.set(key(input), JSON.stringify(input.result), 'EX', ttlSeconds);
      return input.result;
    },
  };
}
