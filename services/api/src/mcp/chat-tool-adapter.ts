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
import { chatToolName } from '../chat/chat-tool-name';
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

// A plan the model produced that our own validation rejected; its message is locally
// generated, unlike an error from the provider.
class PlanRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanRejectedError';
  }
}

export type ChatToolPlan = {
  capabilities: ChatCapability[];
  requiresLookup: boolean;
  tools: ChatFunctionTool[];
  steps: ValidatedChatToolPlan['steps'];
  usage: AIUsageMetrics | null;
  requiresWebSearch?: boolean;
};

const ROUTING_PROMPT = `Classify the latest user request for tool routing.

Use requiresLookup=true for any request that reads or changes the user's own saved Hominem data: looking something up, listing or searching it, or creating, updating, completing, or deleting a record. "Add a task", "remind me to", "note that", and "what is on my list" all qualify. Select every relevant private capability; when ambiguous, include each plausible capability.

Use requiresWebSearch=true for current or time-sensitive public facts, live schedules and scores, recent events, prices, rates, weather, or requests to verify information. Such requests must use web search even if the wording is ambiguous.

Use requiresLookup=false and requiresWebSearch=false for general knowledge, writing, conversation, and stable public facts. Never select a private capability merely because it could be useful.

Capabilities: ${CHAT_CAPABILITIES.join(', ')}.`;

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
      parameters: convertSchemaToJsonSchema(tool.chatInputSchema ?? tool.inputSchema),
    },
  };
}

// The model-facing form of every tool, by name; rebuilt only when the registry changes.
let chatToolProjection: {
  definitions: readonly CapabilityDefinition[];
  byName: ReadonlyMap<string, ChatFunctionToolDefinition>;
} | null = null;

function getChatToolProjection(
  definitions: readonly CapabilityDefinition[],
): ReadonlyMap<string, ChatFunctionToolDefinition> {
  if (chatToolProjection?.definitions !== definitions) {
    const byName = new Map(
      definitions.map((definition) => [definition.name, toChatTool(definition)]),
    );
    chatToolProjection = { definitions, byName };
  }
  return chatToolProjection.byName;
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
    ['possessions', ['possession', 'belonging', 'inventory', 'container', 'gear', 'stuff']],
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
  const projected = getChatToolProjection(definitions);
  const coreDefinitions = selectCoreDefinitions(definitions);
  const toolsFor = (selected: readonly CapabilityDefinition[]) =>
    selected.map((definition) => projected.get(definition.name)!);
  if (!getModelCapabilityProfile(input.model).structuredPlanning) {
    const latestContent = [...input.messages].reverse().find((message) => message.role === 'user');
    const content =
      typeof latestContent?.content === 'string' ? latestContent.content.toLowerCase() : '';
    const capabilities = inferMuseCapabilities(input.messages);
    const selectedDefinitions = definitions.filter(
      (definition) =>
        coreDefinitions.includes(definition) ||
        getToolCapabilities(definition).some((capability) => capabilities.has(capability)),
    );
    const tools: ChatFunctionTool[] = toolsFor(selectedDefinitions);
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
  if (capabilityOutput.requiresLookup && candidateDefinitions.length === 0) {
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
  if (!capabilityOutput.requiresLookup) {
    const coreTools = toolsFor(coreDefinitions);
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
          content: `Create the smallest valid ordered tool plan for the user's request. Only choose tools from the catalog. Schedule prerequisites before dependent tools. Never include a write unless the user requested the change.\n\nTool catalog:\n${buildToolCatalog(candidateDefinitions)}`,
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
    if (!validation.ok) throw new PlanRejectedError(validation.errors.join('; '));
    exactPlan = validation.plan;
  } catch (error) {
    logger.warn('chat_tool_plan_validation_failed', {
      model: input.model,
      failureCategory: 'tool_planning',
      fallbackUsed: true,
      // Which of "the request failed", "the JSON was invalid" and "the plan broke a rule" it was;
      // the fallback hides all three. Only our own validation text is logged: a provider error
      // carries the provider's response body, so for those only the class and status go out
      // (docs/observability.md).
      reason:
        error instanceof PlanRejectedError
          ? error.message.slice(0, 300)
          : error instanceof Error
            ? error.name
            : 'unknown',
      status:
        error instanceof Error && 'status' in error && typeof error.status === 'number'
          ? error.status
          : null,
    });
    exactPlan = { steps: fallbackSteps(candidateDefinitions) };
  }

  const plannedSteps = withSteps(exactPlan.steps, coreDefinitions);
  const selectedTools: ChatFunctionTool[] = plannedSteps.flatMap((step) => {
    const tool = projected.get(step.tool);
    return tool ? [tool] : [];
  });
  if (capabilityOutput.requiresWebSearch) selectedTools.push(WEB_SEARCH_TOOL);
  logger.info('chat_tool_plan', {
    model: input.model,
    capabilities,
    requiresLookup: true,
    candidateTools: selectedTools.map(chatToolName),
    stepCount: exactPlan.steps.length,
  });
  return {
    capabilities,
    requiresLookup: true,
    tools: selectedTools,
    steps: plannedSteps,
    usage: addUsage(capabilityUsage, planUsage),
    requiresWebSearch: capabilityOutput.requiresWebSearch,
  };
}
