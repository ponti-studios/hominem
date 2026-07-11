import { ValidationError } from '@hominem/db';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';

import { CalendarService } from '../application/calendar.service';
import {
  assertReadOnlyMcpCapability,
  defineCapability,
  parseCapabilityInput,
  parseCapabilityOutput,
  type CapabilityDefinition,
} from '../application/capability';
import { FinanceService } from '../application/finance.service';
import {
  calendarOccurrenceSchema,
  calendarSearchQuerySchema,
  calendarUpcomingQuerySchema,
} from '../schemas/calendar.schema';
import {
  financeMonthlySummaryQuerySchema,
  financeMonthlySummarySchema,
} from '../schemas/finance.schema';

const toolNames = [
  'personal_calendar_search',
  'personal_calendar_upcoming',
  'personal_finance_monthly_summary',
] as const;

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

const calendarService = new CalendarService();
const financeService = new FinanceService();

function toolResult(structuredContent: Record<string, unknown>): PersonalMcpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

const definitions = {
  personal_calendar_search: defineCapability({
    name: 'personal_calendar_search',
    title: 'Search calendar events',
    description:
      'Search the authenticated user calendar by literal text across metadata-only event title, description, and location. Returns event metadata and provenance evidence, not event body details.',
    inputSchema: calendarSearchQuerySchema,
    outputSchema: z.object({ events: calendarOccurrenceSchema.array() }),
    readOnly: true,
    scopes: ['calendar:read'],
    sensitivity: 'sensitive',
    resultCap: 50,
    transports: ['mcp'],
  }),
  personal_calendar_upcoming: defineCapability({
    name: 'personal_calendar_upcoming',
    title: 'List upcoming calendar events',
    description:
      'List upcoming non-cancelled calendar occurrences for the authenticated user in a bounded time window.',
    inputSchema: calendarUpcomingQuerySchema,
    outputSchema: z.object({ events: calendarOccurrenceSchema.array() }),
    readOnly: true,
    scopes: ['calendar:read'],
    sensitivity: 'sensitive',
    resultCap: 50,
    transports: ['mcp'],
  }),
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
  personal_calendar_search: {
    definition: definitions.personal_calendar_search,
    invoke: async (ownerUserId, input) => {
      const parsed = parseCapabilityInput(definitions.personal_calendar_search, input);
      const rows = await calendarService.search(ownerUserId, parsed);
      return parseCapabilityOutput(definitions.personal_calendar_search, {
        events: rows,
      });
    },
  },
  personal_calendar_upcoming: {
    definition: definitions.personal_calendar_upcoming,
    invoke: async (ownerUserId, input) => {
      const parsed = parseCapabilityInput(definitions.personal_calendar_upcoming, input ?? {});
      const rows = await calendarService.upcoming(ownerUserId, parsed);
      return parseCapabilityOutput(definitions.personal_calendar_upcoming, {
        events: rows,
      });
    },
  },
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
