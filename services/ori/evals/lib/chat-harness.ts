import {
  AgentRuntimeEventTag,
  defineHarness,
  type AgentHarness,
  type AgentRuntimeEvent,
  type HarnessInvokeOptions,
} from 'ori';

import { openRouterError } from './eval-infra';
import { pricedUsageFromOpenRouter } from './openrouter-usage';

const event = (
  type: AgentRuntimeEventTag,
  payload: Record<string, unknown>,
  model: string,
): AgentRuntimeEvent => {
  const record: AgentRuntimeEvent = { type, payload, model, harness: 'hominem-chat' };
  return record;
};

/** A plain OpenRouter chat-completion harness: no Codex tools, filesystem, or agent loop. */
const chatHarness: AgentHarness = defineHarness({
  name: 'hominem-chat',
  init(registrar) {
    registrar.registerPrompt(async function* (options: HarnessInvokeOptions) {
      const model = options.model ?? process.env.ORI_TARGET_MODEL ?? 'openai/gpt-5-mini';
      const apiKey = options.env?.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for chat evaluation');

      const startedAt = performance.now();
      yield event(AgentRuntimeEventTag.RunStarted, { prompt: options.prompt, model }, model);
      yield event(AgentRuntimeEventTag.SessionStarted, {}, model);
      const turnStartedAt = performance.now();
      yield event(AgentRuntimeEventTag.TurnStarted, { prompt: options.prompt }, model);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: options.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const failure = openRouterError(response.status, await response.text());
        yield event(
          AgentRuntimeEventTag.TurnFailed,
          {
            failure: { message: failure.message },
            errorCategory: 'provider',
            latencyMs: performance.now() - turnStartedAt,
          },
          model,
        );
        yield event(
          AgentRuntimeEventTag.SessionFailed,
          {
            failure: { message: failure.message },
            errorCategory: 'provider',
            latencyMs: performance.now() - startedAt,
          },
          model,
        );
        throw failure;
      }

      const body: {
        id?: string | null;
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
        usage?: { cost?: number | null; total_tokens?: number | null } | null;
      } = await response.json();
      const content = body.choices?.[0]?.message?.content ?? '';
      if (content) yield event(AgentRuntimeEventTag.AssistantTextDelta, { delta: content }, model);
      const metrics = {
        latencyMs: performance.now() - turnStartedAt,
        totalLatencyMs: performance.now() - startedAt,
        usage: pricedUsageFromOpenRouter(body),
        servedModel: body.model ?? model,
      };
      yield event(AgentRuntimeEventTag.TurnSucceeded, metrics, model);
      yield event(AgentRuntimeEventTag.SessionSucceeded, metrics, model);
    });
  },
});

export default chatHarness;
