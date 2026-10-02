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

type RegisteredTool = {
  definition: CapabilityDefinition;
  invoke: (
    ownerUserId: string,
    input: unknown,
    context?: { idempotencyKey?: string },
  ) => Promise<unknown>;
};

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

const tools = new Map<string, RegisteredTool>();
let toolDefinitionsSnapshot: readonly CapabilityDefinition[] | null = null;

export function listTools(): readonly CapabilityDefinition[] {
  if (!toolDefinitionsSnapshot) {
    // Sorted by name rather than left at Map insertion order: register-tools.ts
    // loads per-domain tool files via concurrent dynamic import()s, whose
    // resolution order (and therefore registerTool() call order) isn't
    // guaranteed across cold starts. The 2026-07-28 MCP spec recommends a
    // deterministic tools/list order for client-side caching and prompt-cache
    // hit rates, which an unstable Map order would undermine.
    toolDefinitionsSnapshot = Object.freeze(
      [...tools.values()]
        .map(({ definition }) => definition)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  return toolDefinitionsSnapshot;
}

export function listToolsForScopes(grantedScopes: readonly string[]): CapabilityDefinition[] {
  const granted = new Set(grantedScopes);
  return listTools().filter((tool) => tool.scopes.every((scope) => granted.has(scope)));
}

export function getToolDefinition(name: string): CapabilityDefinition | undefined {
  return tools.get(name)?.definition;
}

export function registerTool<TInputSchema extends z.ZodType, TOutputSchema extends z.ZodType>(
  definition: CapabilityDefinition<string, TInputSchema, TOutputSchema>,
  invoke: (
    ownerUserId: string,
    input: z.output<TInputSchema>,
    context?: { idempotencyKey?: string },
  ) => Promise<z.output<TOutputSchema>>,
): void {
  if (tools.has(definition.name)) {
    throw new ValidationError(`MCP tool is already registered: ${definition.name}`);
  }

  tools.set(definition.name, {
    definition,
    invoke: (ownerUserId, input, context) =>
      invoke(ownerUserId, definition.inputSchema.parse(input), context),
  });
  toolDefinitionsSnapshot = null;
}

export async function callTool(
  ownerUserId: string,
  name: string,
  input: unknown,
  context?: { idempotencyKey?: string },
): Promise<McpToolResult> {
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
}
