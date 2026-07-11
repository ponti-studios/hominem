import { ValidationError } from '@hominem/db';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';

import type { CapabilityDefinition } from '../application/capability';

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  readOnly: true;
  scopes: readonly string[];
  sensitivity: CapabilityDefinition['sensitivity'];
  resultCap: number;
}

export interface McpToolResult extends CallToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
}

type ToolImplementation = {
  definition: McpToolDefinition;
  invoke: (ownerUserId: string, input: unknown) => Promise<unknown>;
};

function toolResult(structuredContent: Record<string, unknown>): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

const tools = new Map<string, ToolImplementation>();

export function listTools(): McpToolDefinition[] {
  return [...tools.values()].map((t) => t.definition);
}

export function registerTool(
  name: string,
  definition: McpToolDefinition,
  invoke: (ownerUserId: string, input: unknown) => Promise<unknown>,
): void {
  tools.set(name, { definition, invoke });
}

export async function callTool(
  ownerUserId: string,
  name: string,
  input: unknown,
): Promise<McpToolResult> {
  const implementation = tools.get(name);
  if (!implementation) {
    throw new ValidationError(`Unknown MCP tool: ${name}`);
  }

  const structuredContent = await implementation.invoke(ownerUserId, input);
  if (!structuredContent || typeof structuredContent !== 'object' || Array.isArray(structuredContent)) {
    throw new ValidationError(`MCP tool returned invalid structured content: ${name}`);
  }

  return toolResult(structuredContent as Record<string, unknown>);
}
