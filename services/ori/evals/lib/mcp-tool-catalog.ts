type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, unknown> };
  };
};

const definitions: Array<[string, string, Record<string, unknown>]> = [
  [
    'travel_countries',
    'Returns countries and places with independent stop, layover, visit, and residence evidence. A place may have multiple evidence types. Use for country-presence questions or when the user asks how their presence in a country is evidenced. Use trip_history for trips, itineraries, flight destinations, dates, or attendees.',
    {},
  ],
  [
    'place_visit_history',
    'Lists visits to places (restaurants, venues, addresses), newest first, with the visited place name and address. Use when the user asks which restaurants, venues, or addresses they visited. Do not use for trip-history questions, destinations, flights, or travel history unless they also ask about place visits.',
    { limit: { type: 'integer' } },
  ],
  [
    'trip_history',
    'Lists past and upcoming trips, newest first, with attendee names. Date bounds are optional; omit them to return all available trips. Use when the user asks about past or upcoming trips, destinations, dates, or attendees. Do not use for restaurant or venue visits without a travel question.',
    { from: { type: 'string' }, to: { type: 'string' } },
  ],
  [
    'people_lookup',
    'Resolves a person name to a stable person ID. Never invent IDs.',
    { query: { type: 'string' } },
  ],
  [
    'person_timeline',
    'Loads a timeline using the personId returned by people_lookup.',
    { personId: { type: 'string' } },
  ],
  [
    'finance_recent_transactions',
    'Lists transactions in a bounded range using dates returned by trip_history.',
    { from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer' } },
  ],
  [
    'finance_monthly_stats',
    'Summarizes one month by currency with income, expenses, net, transaction count and top merchant.',
    { month: { type: 'string' } },
  ],
  [
    'finance_spending_by_category',
    'Reports posted, non-excluded, non-transfer spending by category and currency over a date range.',
    { from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer' } },
  ],
  [
    'finance_top_merchants',
    'Ranks spending by merchant for a date range. currencyCode is null when totals span currencies; requires finance:read.',
    { from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer' } },
  ],
  [
    'finance_transaction_upsert',
    'Creates or updates a finance transaction. Writes finance data and requires confirmation.',
    {
      accountId: { type: 'string' },
      amountCents: { type: 'integer' },
      postedOn: { type: 'string' },
    },
  ],
  [
    'finance_transaction_delete',
    'Deletes a finance transaction. Destructive write that requires confirmation.',
    { id: { type: 'string' } },
  ],
  [
    'finance_transactions_import',
    'Imports or replaces finance transactions. Write that requires confirmation.',
    { transactions: { type: 'array' }, mode: { type: 'string' } },
  ],
  [
    'search_memories',
    'Searches personal memories before a conditional memory write.',
    { query: { type: 'string' } },
  ],
  [
    'remember',
    'Saves one durable personal fact without duplicating an existing memory.',
    { content: { type: 'string' }, title: { type: 'string' } },
  ],
  [
    'list_collections',
    'Lists collections and stable collection IDs before collection writes.',
    { limit: { type: 'integer' } },
  ],
  [
    'create_collection',
    'Requests confirmation to create a collection; no change occurs until approval.',
    { name: { type: 'string' } },
  ],
  [
    'invite_member',
    'Invites a collaborator and requires confirmation immediately before execution.',
    { collectionId: { type: 'string' }, email: { type: 'string' } },
  ],
  [
    'career_applications',
    'Finds career applications and returns stable application IDs.',
    { limit: { type: 'integer' } },
  ],
  [
    'career_application_delete',
    'Deletes an application by ID and requires confirmation.',
    { id: { type: 'string' } },
  ],
  [
    'remove_collection_item',
    'Removes an entity by stable IDs and requires confirmation.',
    { collectionId: { type: 'string' }, entityId: { type: 'string' } },
  ],
  ['career_profile', 'Retrieves current career profile, roles, and skills.', {}],
];

export const tools: ToolDefinition[] = definitions.map(([name, description, properties]) => ({
  type: 'function' as const,
  function: {
    name: name as string,
    description: description as string,
    parameters: { type: 'object', properties },
  },
}));

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
  career: tools.filter((tool) => tool.function.name.startsWith('career_')),
  travel: tools.filter((tool) =>
    ['place_visit_history', 'trip_history'].includes(tool.function.name),
  ),
  travelPresence: tools.filter((tool) => tool.function.name === 'travel_countries'),
  finance: tools.filter((tool) => tool.function.name.startsWith('finance_')),
  people: tools.filter((tool) => ['people_lookup', 'person_timeline'].includes(tool.function.name)),
  personal: tools.filter((tool) =>
    [
      'search_memories',
      'remember',
      'list_collections',
      'create_collection',
      'invite_member',
      'remove_collection_item',
    ].includes(tool.function.name),
  ),
  all: tools,
  general: [],
};
