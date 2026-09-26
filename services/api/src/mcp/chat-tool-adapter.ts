import {
  type AIUsageMetrics,
  type ChatFunctionTool,
  type ChatMessages,
  convertSchemaToJsonSchema,
  createStructuredChatCompletion,
  getModelCapabilityProfile,
  getReasoningConfig,
} from '@hominem/ai';
import { logger } from '@hominem/telemetry';
import { z } from 'zod';

import type { CapabilityDefinition } from '../application/capability';
import { ensureMcpToolsRegistered } from './register-tools';
import {
  buildToolCatalog,
  chatToolPlanSchema,
  describeCapability,
  type ChatToolPlan as ValidatedChatToolPlan,
  validateChatToolPlan,
} from './tool-planner';
import {
  CHAT_CAPABILITIES,
  type ChatCapability,
  getToolCapabilities,
  listTools,
} from './tool-registry';

const capabilityPlanSchema = z.object({
  capabilities: z.array(z.enum(CHAT_CAPABILITIES)).max(CHAT_CAPABILITIES.length),
  requiresLookup: z.boolean(),
});

export type ChatToolPlan = {
  capabilities: ChatCapability[];
  requiresLookup: boolean;
  tools: ChatFunctionTool[];
  steps: ValidatedChatToolPlan['steps'];
  usage: AIUsageMetrics | null;
};

const ROUTING_PROMPT = `Classify whether the latest user request needs current private Hominem data.\n\nUse requiresLookup=true for requests asking about the user's saved, current, or historical data. Select every relevant capability; when ambiguous, include each plausible capability. Use requiresLookup=false for general knowledge, writing, conversation, and public facts that may require web search. Never select a capability merely because it could be useful.\n\nCapabilities: ${CHAT_CAPABILITIES.join(', ')}.`;

type ChatFunctionToolDefinition = Extract<ChatFunctionTool, { function: unknown }>;
const WEB_SEARCH_TOOL: ChatFunctionTool = {
  type: 'openrouter:web_search',
  parameters: {
    engine: 'exa',
    maxResults: 5,
  },
};

function toChatTool(tool: CapabilityDefinition): ChatFunctionToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: describeCapability(tool),
      parameters: convertSchemaToJsonSchema(tool.inputSchema),
    },
  };
}

let chatToolProjection: {
  definitions: readonly CapabilityDefinition[];
  tools: readonly ChatFunctionToolDefinition[];
} | null = null;

function getChatToolProjection(
  definitions: readonly CapabilityDefinition[],
): readonly ChatFunctionToolDefinition[] {
  if (chatToolProjection?.definitions === definitions) return chatToolProjection.tools;

  const tools = definitions.map(toChatTool);
  chatToolProjection = { definitions, tools };
  return tools;
}

function addUsage(first: AIUsageMetrics | null, second: AIUsageMetrics | null) {
  if (!first) return second;
  if (!second) return first;
  return {
    ...second,
    promptTokens: first.promptTokens + second.promptTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    totalTokens: first.totalTokens + second.totalTokens,
    costUsd:
      first.costUsd !== null || second.costUsd !== null
        ? (first.costUsd ?? 0) + (second.costUsd ?? 0)
        : null,
  };
}

function fallbackSteps(
  definitions: readonly CapabilityDefinition[],
): ValidatedChatToolPlan['steps'] {
  return definitions.map((definition) => ({
    tool: definition.name,
    purpose: definition.guidance?.whenToUse ?? definition.description,
    dependsOn: definition.guidance?.dependencies?.map((dependency) => dependency.tool) ?? [],
    arguments: {},
  }));
}

function inferMuseCapabilities(messages: ChatMessages[]): Set<ChatCapability> {
  const latest = [...messages].reverse().find((message) => message.role === 'user');
  const content = typeof latest?.content === 'string' ? latest.content.toLowerCase() : '';
  if (!content) return new Set();

  const matches = new Set<ChatCapability>();
  const terms: Array<[ChatCapability, string[]]> = [
    ['memory', ['memory', 'remember', 'forgotten', 'preference']],
    ['travel', ['travel', 'trip', 'flight', 'hotel', 'visit']],
    ['career', ['career', 'job', 'application', 'work experience', 'resume']],
    ['collections', ['collection', 'invite']],
    [
      'finance',
      [
        'finance',
        'transaction',
        'spending',
        'spend',
        'expense',
        'merchant',
        'net worth',
        'money',
        'checking',
        'savings',
        'account',
        'balance',
        'bank',
        'cash',
        'income',
        'salary',
        'budget',
        'runway',
      ],
    ],
    ['health', ['health', 'workout', 'sleep']],
    ['media', ['media', 'music', 'watch', 'listen']],
    ['people', ['person', 'people', 'contact']],
    ['places', ['place', 'restaurant', 'venue', 'address']],
    ['social', ['social', 'conversation']],
    ['tags', ['tag', 'untag']],
  ];
  for (const [capability, needles] of terms) {
    if (needles.some((needle) => content.includes(needle))) matches.add(capability);
  }
  // Muse cannot reliably emit the structured router response. When phrasing
  // is personal but does not match a domain term, expose the complete catalog
  // so the generation model must ground its answer instead of guessing.
  if (
    matches.size === 0 &&
    /\b(my|mine|i|me|do i|what do i|how much|where have i|have i)\b/.test(content)
  ) {
    for (const capability of CHAT_CAPABILITIES) matches.add(capability);
  }
  return matches;
}

export async function planChatTools(input: {
  model: string;
  messages: ChatMessages[];
}): Promise<ChatToolPlan> {
  await ensureMcpToolsRegistered();
  const definitions = listTools();
  const projectedTools = getChatToolProjection(definitions);
  if (!getModelCapabilityProfile(input.model).structuredPlanning) {
    const capabilities = inferMuseCapabilities(input.messages);
    const selectedDefinitions = definitions.filter((definition) =>
      getToolCapabilities(definition).some((capability) => capabilities.has(capability)),
    );
    const tools: ChatFunctionTool[] = selectedDefinitions.map(
      (definition) => projectedTools[definitions.indexOf(definition)]!,
    );
    if (capabilities.size === 0) tools.push(WEB_SEARCH_TOOL);
    logger.info('chat_tool_plan', {
      model: input.model,
      capabilities: [...capabilities],
      requiresLookup: capabilities.size > 0,
      candidateTools: selectedDefinitions.map((definition) => definition.name),
      router: 'keyword-fallback-for-muse-structured-output-compatibility',
    });
    return {
      capabilities: [...capabilities],
      requiresLookup: capabilities.size > 0,
      tools,
      steps: fallbackSteps(selectedDefinitions),
      usage: null,
    };
  }

  const latestUserMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === 'user');
  const { output: capabilityOutput, usage: capabilityUsage } = await createStructuredChatCompletion(
    {
      model: input.model,
      messages: [
        { role: 'system', content: ROUTING_PROMPT },
        ...(latestUserMessage ? [latestUserMessage] : []),
      ],
      schema: capabilityPlanSchema,
      schemaName: 'chat_capability_plan',
      temperature: 0,
      maxCompletionTokens: 120,
      reasoning: getReasoningConfig(input.model) ?? null,
    },
  );
  const capabilities: ChatCapability[] = [...new Set(capabilityOutput.capabilities)];
  const selectedCapabilities = new Set(capabilities);
  const candidateDefinitions = definitions.filter((definition) =>
    getToolCapabilities(definition).some((capability) => selectedCapabilities.has(capability)),
  );
  const candidateTools = candidateDefinitions.map(
    (definition) => projectedTools[definitions.indexOf(definition)]!,
  );
  if (capabilityOutput.requiresLookup && candidateTools.length === 0) {
    throw new Error('No eligible tool is available for this private-data request');
  }
  if (!capabilityOutput.requiresLookup) {
    return {
      capabilities,
      requiresLookup: false,
      tools: [WEB_SEARCH_TOOL],
      steps: [],
      usage: capabilityUsage,
    };
  }

  let exactPlan: ValidatedChatToolPlan;
  let planUsage: AIUsageMetrics | null = null;
  try {
    const planned = await createStructuredChatCompletion({
      model: input.model,
      messages: [
        {
          role: 'system',
          content: `Create the smallest valid ordered tool plan for the user's request. Only choose tools from the catalog. Schedule prerequisites before dependent tools. Use an empty arguments object when values must be obtained from an earlier tool result. Never include a write unless the user requested the change.\n\nTool catalog:\n${buildToolCatalog(candidateDefinitions)}`,
        },
        ...(latestUserMessage ? [latestUserMessage] : []),
      ],
      schema: chatToolPlanSchema,
      schemaName: 'chat_exact_tool_plan',
      temperature: 0,
      maxCompletionTokens: 400,
      reasoning: getReasoningConfig(input.model) ?? null,
    });
    planUsage = planned.usage;
    const validation = validateChatToolPlan(planned.output, candidateDefinitions);
    if (!validation.ok) throw new Error(validation.errors.join('; '));
    if (!capabilityOutput.requiresLookup || validation.plan.steps.length === 0) {
      throw new Error('Exact plan must preserve the required private-data lookup');
    }
    exactPlan = validation.plan;
  } catch (error) {
    logger.warn('chat_tool_plan_validation_failed', {
      model: input.model,
      error: error instanceof Error ? error.message : 'Unknown planning error',
    });
    exactPlan = { requiresLookup: true, steps: fallbackSteps(candidateDefinitions) };
  }

  const selectedTools = exactPlan.steps.flatMap((step) => {
    const index = definitions.findIndex((definition) => definition.name === step.tool);
    return index === -1 ? [] : [projectedTools[index]!];
  });
  logger.info('chat_tool_plan', {
    model: input.model,
    capabilities,
    requiresLookup: exactPlan.requiresLookup,
    candidateTools: selectedTools.map((tool) => tool.function.name),
    steps: exactPlan.steps,
  });
  return {
    capabilities,
    requiresLookup: exactPlan.requiresLookup,
    tools: selectedTools,
    steps: exactPlan.steps,
    usage: addUsage(capabilityUsage, planUsage),
  };
}
