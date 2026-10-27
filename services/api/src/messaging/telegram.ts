import { z } from 'zod';

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  is_bot: z.boolean().optional(),
});
const telegramChatSchema = z.object({ id: z.number().int(), type: z.string() });

const telegramMessageSchema = z.object({
  message_id: z.number().int(),
  from: telegramUserSchema.optional(),
  chat: telegramChatSchema,
  text: z.string().optional(),
});

const telegramCallbackQuerySchema = z.object({
  id: z.string().min(1),
  from: telegramUserSchema,
  data: z.string().optional(),
  message: z.object({ message_id: z.number().int(), chat: telegramChatSchema }).optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export type TelegramMessage = z.infer<typeof telegramMessageSchema>;
export type TelegramCallbackQuery = z.infer<typeof telegramCallbackQuerySchema>;

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

export function createTelegramClient(input: { botToken: string; fetchImpl?: typeof fetch }) {
  const request = async (method: string, body: Record<string, unknown>): Promise<void> => {
    if (!input.botToken) throw new Error('TelegramDisabled');
    const response = await (input.fetchImpl ?? fetch)(
      `https://api.telegram.org/bot${input.botToken}/${method}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const result = z.object({ ok: z.boolean() }).safeParse(await response.json().catch(() => null));
    if (!response.ok || !result.success || !result.data.ok) {
      throw new Error(`TelegramApiFailed:${method}`);
    }
  };

  return {
    sendText: async (chatId: string, text: string, keyboard?: InlineKeyboard) => {
      const chunks = splitTelegramText(text || 'I could not produce a text reply.');
      for (const [index, chunk] of chunks.entries()) {
        await request('sendMessage', {
          chat_id: chatId,
          text: chunk,
          ...(keyboard && index === chunks.length - 1 ? { reply_markup: keyboard } : {}),
        });
      }
    },
    answerCallback: async (callbackQueryId: string, text = '') =>
      request('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...(text ? { text: text.slice(0, 200) } : {}),
      }),
    setWebhook: async (url: string, secretToken: string) =>
      request('setWebhook', {
        url,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query'],
      }),
  };
}

export function splitTelegramText(value: string, limit = 4096): string[] {
  const output: string[] = [];
  let current = '';
  const appendLong = (paragraph: string) => {
    for (const character of Array.from(paragraph)) {
      if (current.length + character.length > limit) {
        output.push(current);
        current = '';
      }
      current += character;
    }
  };

  for (const paragraph of value.split(/\n\n/)) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= limit) {
      current = next;
      continue;
    }
    if (current) {
      output.push(current);
      current = '';
    }
    appendLong(paragraph);
  }
  if (current) output.push(current);
  return output.length ? output : [''];
}
