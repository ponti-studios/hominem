import {
  CalendarQueryRepository,
  FinanceQueryRepository,
  ImportHealthRepository,
  ValidationError,
} from '@hominem/db';
import * as z from 'zod';

import {
  calendarOccurrenceSchema,
  calendarSearchQuerySchema,
  calendarUpcomingQuerySchema,
  financeMonthlySummaryQuerySchema,
  financeMonthlySummarySchema,
  personalDataHealthSchema,
} from '../schemas/personal-data.schema';

const toolNames = [
  'personal_calendar_search',
  'personal_calendar_upcoming',
  'personal_finance_monthly_summary',
  'personal_data_health',
] as const;

export type PersonalMcpToolName = (typeof toolNames)[number];

export interface PersonalMcpToolDefinition {
  name: PersonalMcpToolName;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  readOnly: true;
  scopes: readonly string[];
}

export interface PersonalMcpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: unknown;
}

type ToolImplementation = {
  definition: PersonalMcpToolDefinition;
  invoke: (ownerUserId: string, input: unknown) => Promise<unknown>;
};

function toolResult(structuredContent: unknown): PersonalMcpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

const implementations = {
  personal_calendar_search: {
    definition: {
      name: 'personal_calendar_search',
      title: 'Search calendar events',
      description:
        'Search the authenticated user calendar by literal text across metadata-only event title, description, and location. Returns event metadata and provenance evidence, not event body details.',
      inputSchema: calendarSearchQuerySchema,
      readOnly: true,
      scopes: ['calendar:read'],
    },
    invoke: async (ownerUserId, input) => {
      const parsed = calendarSearchQuerySchema.parse(input);
      const rows = await CalendarQueryRepository.search(ownerUserId, parsed);
      return { events: calendarOccurrenceSchema.array().parse(rows) };
    },
  },
  personal_calendar_upcoming: {
    definition: {
      name: 'personal_calendar_upcoming',
      title: 'List upcoming calendar events',
      description:
        'List upcoming non-cancelled calendar occurrences for the authenticated user in a bounded time window.',
      inputSchema: calendarUpcomingQuerySchema,
      readOnly: true,
      scopes: ['calendar:read'],
    },
    invoke: async (ownerUserId, input) => {
      const parsed = calendarUpcomingQuerySchema.parse(input ?? {});
      const rows = await CalendarQueryRepository.upcoming(ownerUserId, parsed);
      return { events: calendarOccurrenceSchema.array().parse(rows) };
    },
  },
  personal_finance_monthly_summary: {
    definition: {
      name: 'personal_finance_monthly_summary',
      title: 'Summarize monthly finance activity',
      description:
        'Summarize authenticated user spending, income, top merchants, and bounded transaction evidence for one calendar month.',
      inputSchema: financeMonthlySummaryQuerySchema,
      readOnly: true,
      scopes: ['finance:read'],
    },
    invoke: async (ownerUserId, input) => {
      const parsed = financeMonthlySummaryQuerySchema.parse(input);
      const summary = await FinanceQueryRepository.monthlySummary(ownerUserId, parsed);
      return financeMonthlySummarySchema.parse(summary);
    },
  },
  personal_data_health: {
    definition: {
      name: 'personal_data_health',
      title: 'Report personal data health',
      description:
        'Report aggregate import freshness, canonical record counts, source status, and non-sensitive quality warnings for the authenticated user.',
      inputSchema: z.object({}).strict(),
      readOnly: true,
      scopes: ['provenance:read'],
    },
    invoke: async (ownerUserId, input) => {
      z.object({})
        .strict()
        .parse(input ?? {});
      const health = await ImportHealthRepository.getPersonalDataHealth(ownerUserId);
      return personalDataHealthSchema.parse(health);
    },
  },
} satisfies Record<PersonalMcpToolName, ToolImplementation>;

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
  return toolResult(structuredContent);
}
