import { readFileSync } from 'node:fs';

import { z } from 'zod';

const toolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z
      .object({ type: z.literal('object'), properties: z.record(z.string(), z.unknown()) })
      .passthrough(),
  }),
});

type ToolDefinition = z.infer<typeof toolSchema>;
const catalogPath = new URL('./mcp-tool-catalog.generated.json', import.meta.url);
const catalog = z.array(toolSchema).parse(JSON.parse(readFileSync(catalogPath, 'utf8')));

// Domain membership is an eval design choice; definitions and schemas come from the API.
const selectedToolNames = [
  'travel_countries',
  'place_visit_history',
  'trip_history',
  'people_lookup',
  'person_timeline',
  'finance_recent_transactions',
  'finance_monthly_stats',
  'finance_spending_by_category',
  'finance_top_merchants',
  'finance_transaction_upsert',
  'finance_transaction_delete',
  'finance_transactions_import',
  'search_memories',
  'remember',
  'list_collections',
  'create_collection',
  'invite_member',
  'career_applications',
  'career_application_delete',
  'remove_collection_item',
  'career_profile',
] as const;

const byName = new Map(catalog.map((tool) => [tool.function.name, tool]));
const select = (names: readonly string[]): ToolDefinition[] =>
  names.map((name) => {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Eval MCP tool is missing from the API catalog: ${name}`);
    return tool;
  });

export const tools = select(selectedToolNames);

export type McpToolDomain =
  | 'career'
  | 'travel'
  | 'travelPresence'
  | 'finance'
  | 'people'
  | 'personal'
  | 'all'
  | 'general';

export const toolsByDomain: Record<McpToolDomain, readonly ToolDefinition[]> = {
  career: select(['career_applications', 'career_application_delete', 'career_profile']),
  travel: select(['place_visit_history', 'trip_history']),
  travelPresence: select(['travel_countries']),
  finance: select([
    'finance_recent_transactions',
    'finance_monthly_stats',
    'finance_spending_by_category',
    'finance_top_merchants',
    'finance_transaction_upsert',
    'finance_transaction_delete',
    'finance_transactions_import',
  ]),
  people: select(['people_lookup', 'person_timeline']),
  personal: select([
    'search_memories',
    'remember',
    'list_collections',
    'create_collection',
    'invite_member',
    'remove_collection_item',
  ]),
  all: tools,
  general: [],
};
