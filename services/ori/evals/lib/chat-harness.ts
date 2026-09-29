import {
  AgentRuntimeEventTag,
  defineHarness,
  type AgentHarness,
  type AgentRuntimeEvent,
  type HarnessInvokeOptions,
} from 'ori';

const event = (
  type: AgentRuntimeEventTag,
  payload: Record<string, unknown>,
  model: string,
): AgentRuntimeEvent => ({ type, payload, model, harness: 'hominem-chat' }) as AgentRuntimeEvent;

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
        const detail = await response.text();
        const failure = {
          failure: { message: `OpenRouter request failed (${response.status})` },
          errorCategory: 'provider',
          latencyMs: performance.now() - turnStartedAt,
        };
        yield event(AgentRuntimeEventTag.TurnFailed, failure, model);
        yield event(
          AgentRuntimeEventTag.SessionFailed,
          {
            failure: { message: detail },
            errorCategory: 'provider',
            latencyMs: performance.now() - startedAt,
          },
          model,
        );
        return;
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
        usage?: Record<string, unknown> | null;
      };
      const content = body.choices?.[0]?.message?.content ?? '';
      if (content) yield event(AgentRuntimeEventTag.AssistantTextDelta, { delta: content }, model);
      const metrics = {
        latencyMs: performance.now() - turnStartedAt,
        totalLatencyMs: performance.now() - startedAt,
        usage: body.usage ?? null,
        servedModel: body.model ?? model,
      };
      yield event(AgentRuntimeEventTag.TurnSucceeded, metrics, model);
      yield event(AgentRuntimeEventTag.SessionSucceeded, metrics, model);
    });
  },
});

export default chatHarness;
