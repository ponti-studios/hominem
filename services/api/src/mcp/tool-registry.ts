import { ValidationError } from '@hominem/db/errors';
import { isObject } from '@hominem/utils';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';

import {
  CAPABILITIES,
  type Capability,
  type CapabilityDefinition,
} from '../application/capability';

// `Capability`/`CAPABILITIES` in `application/capability.ts` are the single source of
// truth for capability domains; re-exported here under their long-standing chat-facing
// names so existing consumers (chat-tool-adapter, tests) don't need to change imports.
export const CHAT_CAPABILITIES = CAPABILITIES;
export type ChatCapability = Capability;

export function getToolCapabilities(definition: CapabilityDefinition): ChatCapability[] {
  // `scope` is typed as `${Capability}:${ScopeAction}`, so the prefix is guaranteed to
  // be a valid Capability by construction — no runtime membership check needed.
  return [
    ...new Set(
      definition.scopes.flatMap((scope) =>
        CAPABILITIES.filter((capability) => scope.startsWith(`${capability}:`)),
      ),
    ),
  ];
}

type McpToolContentBlock =
  | { type: 'text'; text: string }
  | { type: 'resource_link'; uri: string; name: string };

export type McpToolResult<T = Record<string, unknown>> = Omit<
  CallToolResult,
  'structuredContent'
> & {
  content: McpToolContentBlock[];
  structuredContent: T | Record<string, unknown> | null;
};

export type DefinedMcpTool = {
  definition: CapabilityDefinition;
  invoke: (
    ownerUserId: string,
    input: unknown,
    context?: { idempotencyKey?: string; isAdmin?: boolean },
  ) => Promise<unknown>;
};

export type DefinedMcpSlice = {
  name: string;
  tools: readonly DefinedMcpTool[];
};

export function defineMcpSlice(slice: {
  name: string;
  tools: readonly DefinedMcpTool[];
}): DefinedMcpSlice {
  const name = slice.name.trim();
  if (!name) throw new ValidationError('MCP slice name cannot be empty');
  if (slice.tools.length === 0) throw new ValidationError(`MCP slice cannot be empty: ${name}`);

  const toolNames = slice.tools.map((tool) => tool.definition.name);
  if (new Set(toolNames).size !== toolNames.length) {
    throw new ValidationError(`MCP slice contains duplicate tools: ${name}`);
  }

  return Object.freeze({ name, tools: Object.freeze([...slice.tools]) });
}

export function defineMcpTool<TInputSchema extends z.ZodType, TOutputSchema extends z.ZodType>(
  definition: CapabilityDefinition<string, TInputSchema, TOutputSchema>,
  invoke: (
    ownerUserId: string,
    input: z.output<TInputSchema>,
    context?: { idempotencyKey?: string; isAdmin?: boolean },
  ) => Promise<z.output<TOutputSchema>>,
): DefinedMcpTool {
  return {
    definition,
    invoke: (ownerUserId, input, context) =>
      invoke(ownerUserId, definition.inputSchema.parse(input), context),
  };
}

function toolResult(
  structuredContent: Record<string, unknown> | null,
  resourceLinks: ReadonlyArray<{ uri: string; name: string }> = [],
): McpToolResult {
  return {
    content: [
      { type: 'text', text: JSON.stringify(structuredContent) },
      ...resourceLinks.map(
        (link) => ({ type: 'resource_link', uri: link.uri, name: link.name }) as const,
      ),
    ],
    structuredContent,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

function enforceResultCap(result: Record<string, unknown>, toolName: string, resultCap: number) {
  for (const [field, value] of Object.entries(result)) {
    if (Array.isArray(value) && value.length > resultCap) {
      throw new ValidationError(
        `MCP tool result exceeds its cap: ${toolName}.${field} (${resultCap})`,
      );
    }
  }
}

export function createToolRegistry(initialSlices: readonly DefinedMcpSlice[] = []) {
  const tools = new Map<string, DefinedMcpTool>();
  const slices = new Set<string>();
  let toolDefinitionsSnapshot: readonly CapabilityDefinition[] | null = null;

  const registerToolDefinition = (tool: DefinedMcpTool) => {
    if (tools.has(tool.definition.name)) {
      throw new ValidationError(`MCP tool is already registered: ${tool.definition.name}`);
    }

    tools.set(tool.definition.name, tool);
    toolDefinitionsSnapshot = null;
  };

  const registerSlice = (slice: DefinedMcpSlice) => {
    if (slices.has(slice.name)) {
      throw new ValidationError(`MCP slice is already registered: ${slice.name}`);
    }

    const toolNames = slice.tools.map((tool) => tool.definition.name);
    const duplicateTool = toolNames.find((name, index) => toolNames.indexOf(name) !== index);
    const existingTool = toolNames.find((name) => tools.has(name));
    if (duplicateTool || existingTool) {
      throw new ValidationError(
        `MCP slice contains a duplicate tool: ${duplicateTool ?? existingTool}`,
      );
    }

    slices.add(slice.name);
    for (const tool of slice.tools) registerToolDefinition(tool);
  };

  for (const slice of initialSlices) registerSlice(slice);

  const listTools = (): readonly CapabilityDefinition[] => {
    if (!toolDefinitionsSnapshot) {
      // Sorted by name rather than left at Map insertion order: registration order may vary
      // across cold starts. Stable order helps client-side and prompt-cache hits.
      toolDefinitionsSnapshot = Object.freeze(
        [...tools.values()]
          .map(({ definition }) => definition)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }

    return toolDefinitionsSnapshot;
  };

  const listToolsForScopes = (grantedScopes: readonly string[]): CapabilityDefinition[] => {
    const granted = new Set(grantedScopes);
    return listTools().filter((tool) => tool.scopes.every((scope) => granted.has(scope)));
  };

  const getToolDefinition = (name: string): CapabilityDefinition | undefined =>
    tools.get(name)?.definition;

  const callTool = async (
    ownerUserId: string,
    name: string,
    input: unknown,
    context?: { idempotencyKey?: string; isAdmin?: boolean },
  ): Promise<McpToolResult> => {
    const implementation = tools.get(name);
    if (!implementation) {
      throw new ValidationError(`Unknown MCP tool: ${name}`);
    }

    const structuredContent = await implementation.invoke(ownerUserId, input, context);
    const parsedOutput = implementation.definition.outputSchema.parse(structuredContent);

    if (parsedOutput === null) {
      return toolResult(null);
    }

    if (!isRecord(parsedOutput)) {
      throw new ValidationError(`MCP tool returned invalid structured content: ${name}`);
    }

    const result = parsedOutput;
    enforceResultCap(result, name, implementation.definition.resultCap);
    const resourceLinks = implementation.definition.resourceLinks?.(result) ?? [];
    return toolResult(result, resourceLinks);
  };

  return {
    callTool,
    getToolDefinition,
    listTools,
    listToolsForScopes,
    registerSlice,
    registerToolDefinition,
  };
}

const defaultToolRegistry = createToolRegistry();

export const listTools = () => defaultToolRegistry.listTools();

export const listToolsForScopes = (grantedScopes: readonly string[]) =>
  defaultToolRegistry.listToolsForScopes(grantedScopes);

export const getToolDefinition = (name: string) => defaultToolRegistry.getToolDefinition(name);

export function registerTool<TInputSchema extends z.ZodType, TOutputSchema extends z.ZodType>(
  definition: CapabilityDefinition<string, TInputSchema, TOutputSchema>,
  invoke: (
    ownerUserId: string,
    input: z.output<TInputSchema>,
    context?: { idempotencyKey?: string; isAdmin?: boolean },
  ) => Promise<z.output<TOutputSchema>>,
): void {
  defaultToolRegistry.registerToolDefinition(defineMcpTool(definition, invoke));
}

export function registerDefinedMcpSlice(slice: DefinedMcpSlice): void {
  defaultToolRegistry.registerSlice(slice);
}

export async function callTool(
  ownerUserId: string,
  name: string,
  input: unknown,
  context?: { idempotencyKey?: string; isAdmin?: boolean },
): Promise<McpToolResult> {
  return defaultToolRegistry.callTool(ownerUserId, name, input, context);
}
