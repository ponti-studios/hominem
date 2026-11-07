import { getModelCapabilityProfile } from '@hominem/ai/model-capabilities';
import { CHAT_MODEL } from '@hominem/ai/shared';
import { createStructuredChatCompletion } from '@hominem/ai/text';

import {
  createModelSlot,
  modelDecisionSchema,
  toProactivityDecision,
  type ProactivityGenerate,
} from './slot.js';

export type OpenRouterProactivitySlotOptions = {
  /** Overrides the model used for evaluation. Defaults to CHAT_MODEL. */
  model?: string;
  maxAttempts?: number;
};

/**
 * Wires the proactivity slot to the shared OpenRouter client. The decision
 * schema is sent as the structured-output contract, and the slot validates and
 * retries the response before the engine ever sees it.
 */
export function createOpenRouterProactivitySlot(options: OpenRouterProactivitySlotOptions = {}) {
  const model = options.model ?? process.env.PROACTIVITY_MODEL ?? CHAT_MODEL;
  const profile = getModelCapabilityProfile(model);
  if (!profile.structuredPlanning) {
    throw new Error(
      `${model} does not support structured planning, which the proactivity evaluator requires.`,
    );
  }

  const generate: ProactivityGenerate = async ({
    system,
    prompt,
    schemaName,
    schemaDescription,
  }) => {
    const { output } = await createStructuredChatCompletion({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      schema: modelDecisionSchema,
      schemaName,
      schemaDescription,
      temperature: 0,
      reasoning: profile.reasoning ?? null,
      maxCompletionTokens: 1_200,
    });
    return toProactivityDecision(output);
  };

  return createModelSlot({ generate, maxAttempts: options.maxAttempts });
}
