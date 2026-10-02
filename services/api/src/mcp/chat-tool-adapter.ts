import {
  type AIUsageMetrics,
  type ChatFunctionTool,
  type ChatMessages,
  convertSchemaToJsonSchema,
  createStructuredChatCompletion,
  getModelCapabilityProfile,
  getReasoningConfig,
} from '@hominem/ai';
import { ChatHttpClientError } from '@hominem/chat/server';
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
  requiresWebSearch: z.boolean().default(false),
});

export type ChatToolPlan = {
  capabilities: ChatCapability[];
  requiresLookup: boolean;
  tools: ChatFunctionTool[];
  steps: ValidatedChatToolPlan['steps'];
  usage: AIUsageMetrics | null;
  requiresWebSearch?: boolean;
};

const ROUTING_PROMPT = `Classify the latest user request for tool routing.\n\nUse requiresLookup=true for requests asking about the user's saved, current, or historical Hominem data. Select every relevant private capability; when ambiguous, include each plausible capability. Use requiresWebSearch=true for current or time-sensitive public facts, live schedules and scores, recent events, prices, rates, weather, or requests to verify information. Such requests must use web search even if the wording is ambiguous. Use requiresWebSearch=false for general knowledge, writing, conversation, and stable public facts. Never select a private capability merely because it could be useful.\n\nCapabilities: ${CHAT_CAPABILITIES.join(', ')}.`;

type ChatFunctionToolDefinition = Extract<ChatFunctionTool, { function: unknown }>;
const WEB_SEARCH_TOOL: ChatFunctionTool = {
  type: 'openrouter:web_search',
  parameters: {
    engine: 'exa',
    maxResults: 5,
    maxTotalResults: 5,
  },
};

const CURRENT_PUBLIC_FACT_PATTERN =
  /\b(current|today|tonight|tomorrow|next|latest|recent|schedule|score|scores|price|rate|weather|when do|what time|verify)\b/;

// The router above only decides which *extra* capabilities a turn needs. It is a
// classifier, so it will sometimes misjudge a request (e.g. "add a task" is a write,
// not a lookup). If it were the only source of tools, a misjudgment would leave the
// model with nothing to call and it would narrate an action it cannot take. These
// everyday capabilities are therefore always exposed, with toolChoice left on 'auto'.
const CORE_CAPABILITIES: readonly ChatCapability[] = ['task', 'notes', 'memory'];

function selectCoreDefinitions(
  definitions: readonly CapabilityDefinition[],
): CapabilityDefinition[] {
  return definitions.filter((definition) =>
    getToolCapabilities(definition).some((capability) => CORE_CAPABILITIES.includes(capability)),
  );
}

// Appends steps for `extra` tools that the plan does not already schedule.
function withSteps(
  steps: ValidatedChatToolPlan['steps'],
  extra: readonly CapabilityDefinition[],
): ValidatedChatToolPlan['steps'] {
  const scheduled = new Set(steps.map((step) => step.tool));
  return [
    ...steps,
    ...fallbackSteps(extra.filter((definition) => !scheduled.has(definition.name))),
  ];
}

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

function chatToolName(tool: ChatFunctionTool): string {
  return 'function' in tool ? tool.function.name : tool.type;
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
    ['notes', ['note', 'journal', 'wrote down']],
    ['people', ['person', 'people', 'contact']],
    ['places', ['place', 'restaurant', 'venue', 'address']],
    ['social', ['social', 'conversation']],
    ['tags', ['tag', 'untag']],
    ['task', ['task', 'to-do', 'todo', 'checklist', 'reminder']],
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
    const latestContent = [...input.messages].reverse().find((message) => message.role === 'user');
    const content =
      typeof latestContent?.content === 'string' ? latestContent.content.toLowerCase() : '';
    const capabilities = inferMuseCapabilities(input.messages);
    const routedDefinitions = definitions.filter((definition) =>
      getToolCapabilities(definition).some((capability) => capabilities.has(capability)),
    );
    const selectedDefinitions = definitions.filter(
      (definition) =>
        routedDefinitions.includes(definition) ||
        selectCoreDefinitions(definitions).includes(definition),
    );
    const tools: ChatFunctionTool[] = selectedDefinitions.map(
      (definition) => projectedTools[definitions.indexOf(definition)]!,
    );
    const requiresWebSearch = CURRENT_PUBLIC_FACT_PATTERN.test(content);
    if (requiresWebSearch) tools.push(WEB_SEARCH_TOOL);
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
      requiresWebSearch,
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
    const latestContent =
      typeof latestUserMessage?.content === 'string' ? latestUserMessage.content.toLowerCase() : '';
    const calendarRequest = /\b(calendar|event|schedule)\b/.test(latestContent);
    logger.warn('chat_tool_plan_unavailable', {
      model: input.model,
      capabilities,
      requiresLookup: true,
      candidateToolCount: 0,
      reason: calendarRequest ? 'calendar_capability_unavailable' : 'no_eligible_private_tool',
    });
    throw new ChatHttpClientError({
      code: 'UNSUPPORTED_CAPABILITY',
      message: calendarRequest
        ? 'I can search the web, but I cannot add calendar events from this chat yet.'
        : 'I cannot complete that personal-data request from this chat yet.',
    });
  }
  const coreDefinitions = selectCoreDefinitions(definitions);
  if (!capabilityOutput.requiresLookup) {
    const coreTools = coreDefinitions.map(
      (definition) => projectedTools[definitions.indexOf(definition)]!,
    );
    return {
      capabilities,
      requiresLookup: false,
      tools: capabilityOutput.requiresWebSearch ? [...coreTools, WEB_SEARCH_TOOL] : coreTools,
      steps: fallbackSteps(coreDefinitions),
      usage: capabilityUsage,
      requiresWebSearch: capabilityOutput.requiresWebSearch,
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
      failureCategory: 'tool_planning',
      fallbackUsed: true,
    });
    exactPlan = {
      requiresLookup: true,
      steps: fallbackSteps(candidateDefinitions),
    };
  }

  const plannedSteps = withSteps(exactPlan.steps, coreDefinitions);
  const selectedTools: ChatFunctionTool[] = plannedSteps.flatMap((step) => {
    const index = definitions.findIndex((definition) => definition.name === step.tool);
    return index === -1 ? [] : [projectedTools[index]!];
  });
  if (capabilityOutput.requiresWebSearch) selectedTools.push(WEB_SEARCH_TOOL);
  logger.info('chat_tool_plan', {
    model: input.model,
    capabilities,
    requiresLookup: exactPlan.requiresLookup,
    candidateTools: selectedTools.map(chatToolName),
    stepCount: exactPlan.steps.length,
  });
  return {
    capabilities,
    requiresLookup: exactPlan.requiresLookup,
    tools: selectedTools,
    steps: plannedSteps,
    usage: addUsage(capabilityUsage, planUsage),
    requiresWebSearch: capabilityOutput.requiresWebSearch,
  };
}
