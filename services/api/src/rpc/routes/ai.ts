import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { env } from '../../env';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const ENHANCE_MODEL = 'google/gemini-2.5-flash-lite';

const enhanceSchema = z.object({
  text: z.string().min(1).max(8000),
});

function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://hominem.app',
    'X-Title': 'Hominem',
  };
}

const ENHANCE_SYSTEM_PROMPT = `You are a text editor. The user has dictated text using voice input and wants it cleaned up.

Your job:
- Fix grammar, punctuation, and capitalization
- Remove filler words (um, uh, like, you know)
- Break run-on sentences into clear, readable sentences
- Preserve the user's meaning and voice exactly — do not paraphrase or add new content
- Return only the cleaned text with no commentary, no quotes, no prefix

If the input is already clean, return it unchanged.`;

export const aiRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use(
    '/enhance',
    rateLimitMiddleware({ bucket: 'ai-enhance', identifier: 'enhance', windowSec: 60, max: 30 }),
  )
  .post('/enhance', zValidator('json', enhanceSchema), async (c) => {
    const { text } = c.req.valid('json');
    const apiKey = env.OPENROUTER_API_KEY?.trim();

    if (!apiKey) {
      logger.error('[ai/enhance] Missing OPENROUTER_API_KEY');
      return c.json({ error: 'AI service unavailable' }, 503);
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model: ENHANCE_MODEL,
        messages: [
          { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      logger.error('[ai/enhance] OpenRouter error', { status: response.status });
      return c.json({ error: 'Enhancement failed' }, 500);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const enhanced = data.choices?.[0]?.message?.content?.trim() ?? text;

    return c.json({ text: enhanced });
  });
