import { ValidationError } from '@hominem/db';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';

import {
  assertReadOnlyMcpCapability,
  defineCapability,
  parseCapabilityInput,
  parseCapabilityOutput,
  type CapabilityDefinition,
} from '../application/capability';
import { FinanceService } from '../application/finance.service';
import {
  financeMonthlySummaryQuerySchema,
  financeMonthlySummarySchema,
} from '../schemas/finance.schema';

const toolNames = ['personal_finance_monthly_summary'] as const;

export type PersonalMcpToolName = (typeof toolNames)[number];

export interface PersonalMcpToolDefinition {
  name: PersonalMcpToolName;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  readOnly: true;
  scopes: readonly string[];
  sensitivity: CapabilityDefinition['sensitivity'];
  resultCap: number;
}

export interface PersonalMcpToolResult extends CallToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
}

type ToolImplementation = {
  definition: PersonalCapabilityDefinition;
  invoke: (ownerUserId: string, input: unknown) => Promise<unknown>;
};

type PersonalCapabilityDefinition = CapabilityDefinition<
  PersonalMcpToolName,
  z.ZodType,
  z.ZodType
> & {
  readOnly: true;
  transports: readonly ['mcp'];
};

const financeService = new FinanceService();

function toolResult(structuredContent: Record<string, unknown>): PersonalMcpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

const definitions = {
  personal_finance_monthly_summary: defineCapability({
    name: 'personal_finance_monthly_summary',
    title: 'Summarize monthly finance activity',
    description:
      'Summarize authenticated user spending, income, top merchants, and bounded transaction evidence for one calendar month.',
    inputSchema: financeMonthlySummaryQuerySchema,
    outputSchema: financeMonthlySummarySchema,
    readOnly: true,
    scopes: ['finance:read'],
    sensitivity: 'highly_sensitive',
    resultCap: 50,
    transports: ['mcp'],
  }),
} satisfies Record<PersonalMcpToolName, PersonalCapabilityDefinition>;

const implementations = {
  personal_finance_monthly_summary: {
    definition: definitions.personal_finance_monthly_summary,
    invoke: async (ownerUserId, input) => {
      const parsed = parseCapabilityInput(definitions.personal_finance_monthly_summary, input);
      const summary = await financeService.monthlySummary(ownerUserId, parsed);
      return parseCapabilityOutput(definitions.personal_finance_monthly_summary, summary);
    },
  },
} satisfies Record<PersonalMcpToolName, ToolImplementation>;

for (const implementation of Object.values(implementations)) {
  assertReadOnlyMcpCapability(implementation.definition);
}

export function listPersonalMcpTools(): PersonalMcpToolDefinition[] {
  return toolNames.map((name) => implementations[name].definition);
}

export async function callPersonalMcpTool(
  ownerUserId: string,
  name: string,
  input: unknown,
): Promise<PersonalMcpToolResult> {
  const implementation = implementations[name as PersonalMcpToolName];
  if (!implementation) {
    throw new ValidationError(`Unknown personal MCP tool: ${name}`);
  }

  const structuredContent = await implementation.invoke(ownerUserId, input);
  if (!structuredContent || typeof structuredContent !== 'object' || Array.isArray(structuredContent)) {
    throw new ValidationError(`MCP tool returned invalid structured content: ${name}`);
  }

  return toolResult(structuredContent);
}
