// Seeds the stable test account with the data the MCP user-request benchmark assumes.
// Idempotent: every record is looked up first and skipped when it already exists.
//
// Writes go through the real MCP endpoint (call_write_tool), so the seed exercises the same
// path as the eval. Refuses to run unless the operator names the target account.
//
// Usage:
//   HOMINEM_EVAL_SEED_ACCOUNT=mcp-eval-e2e@test.hominem.dev \
//   HOMINEM_EVAL_API_URL=http://localhost:4042 \
//   HOMINEM_EVAL_MCP_TOKEN=... pnpm exec tsx evals/seed/seed-test-account.mts
import { McpClient, resolveApiBase } from '../providers/mcp-live-agent.ts';

const ALLOWED_ACCOUNT = 'mcp-eval-e2e@test.hominem.dev';
if (process.env.HOMINEM_EVAL_SEED_ACCOUNT !== ALLOWED_ACCOUNT) {
  throw new Error(`refusing to seed: set HOMINEM_EVAL_SEED_ACCOUNT=${ALLOWED_ACCOUNT}`);
}
const token = process.env.HOMINEM_EVAL_MCP_TOKEN;
if (!token) throw new Error('HOMINEM_EVAL_MCP_TOKEN is required');
const client = new McpClient(resolveApiBase(), token);

type Result = { text: string; data: unknown; code?: string };

function parse(result: unknown): Result {
  const r = result as {
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: unknown;
  };
  const text = r.content?.find((part) => part.type === 'text')?.text ?? '';
  const data = r.structuredContent ?? text;
  const code =
    typeof r.structuredContent === 'object' &&
    r.structuredContent !== null &&
    'code' in r.structuredContent
      ? String((r.structuredContent as { code: unknown }).code)
      : undefined;
  return { text, data, code };
}

async function read(name: string, args: Record<string, unknown>): Promise<string> {
  const res = parse(
    await client.rpc('tools/call', {
      name: 'call_read_tool',
      arguments: { name, arguments: args },
    }),
  );
  return JSON.stringify(res.data);
}

// Writes that need confirmation are completed in the same run: preview, token, confirmed call.
async function write(name: string, args: Record<string, unknown>): Promise<Result> {
  const first = parse(
    await client.rpc('tools/call', {
      name: 'call_write_tool',
      arguments: { name, arguments: args },
    }),
  );
  if (first.code !== 'confirmation_required') return first;
  const token = /confirmToken: "(v1\.[^"]+)"/.exec(first.text)?.[1];
  if (!token) throw new Error(`${name} needs confirmation but no token was returned`);
  return parse(
    await client.rpc('tools/call', {
      name: 'call_write_tool',
      arguments: { name, arguments: { ...args, confirmToken: token } },
    }),
  );
}

const log: string[] = [];
const created = (what: string) => log.push(`created  ${what}`);
const skipped = (what: string) => log.push(`skipped  ${what}`);

async function ensure(
  label: string,
  exists: () => Promise<boolean>,
  create: () => Promise<unknown>,
) {
  if (await exists()) return skipped(label);
  const res = await create();
  const failure = (res as Result | undefined)?.code;
  if (failure)
    throw new Error(
      `${label}: write failed with ${failure}: ${(res as Result).text.slice(0, 200)}`,
    );
  created(label);
}

// People, notes, collections
for (const displayName of ['Priya', 'Sam']) {
  await ensure(
    `person ${displayName}`,
    async () => (await read('people_lookup', { query: displayName })).includes(displayName),
    () => write('person_create', { displayName }),
  );
}
await ensure(
  'note "Lisbon trip ideas"',
  async () => (await read('note_list', { query: 'Lisbon' })).includes('Lisbon'),
  () =>
    write('note_create', {
      title: 'Lisbon trip ideas',
      content: 'Lisbon trip: stay near Alfama, day trip to Sintra, lunch at the Time Out market.',
    }),
);
await ensure(
  'note "Kyoto guide"',
  async () => (await read('note_list', { query: 'Kyoto' })).includes('Kyoto guide'),
  () =>
    write('note_create', {
      title: 'Kyoto guide',
      content:
        'Kyoto guide: Fushimi Inari at sunrise, Nishiki market for lunch, Gion in the evening.',
    }),
);
await ensure(
  'task "Dentist appointment"',
  async () => (await read('task_list', { query: 'Dentist' })).includes('Dentist appointment'),
  () =>
    write('task_create', {
      title: 'Dentist appointment',
      artifactType: 'task',
    }),
);
await ensure(
  'collection "Japan"',
  async () => (await read('list_collections', { limit: 50 })).includes('"Japan"'),
  () => write('create_collection', { name: 'Japan' }),
);

// Career
await ensure(
  'engagement "Migration project"',
  async () => (await read('career_engagements', { limit: 50 })).includes('Migration project'),
  () =>
    write('career_engagement_create', {
      company: 'Acme Corp',
      title: 'Migration project',
      kind: 'CONTRACT',
    }),
);
await ensure(
  'application Acme backend engineer',
  async () => (await read('career_applications', { limit: 50 })).includes('Backend engineer'),
  () =>
    write('career_application_create', {
      company: 'Acme',
      title: 'Backend engineer',
      status: 'APPLIED',
    }),
);
await ensure(
  'wishlist Linear',
  async () => (await read('career_wishlist_companies', { limit: 50 })).includes('Linear'),
  () => write('career_wishlist_add', { company: 'Linear' }),
);

// Possessions and containers
await ensure(
  'container Garage',
  async () => (await read('container_list', { query: 'Garage' })).includes('Garage'),
  () => write('container_create', { name: 'Garage' }),
);
await ensure(
  'possession Vintage bike',
  async () =>
    (await read('possession_list', { query: 'Vintage bike', limit: 20 })).includes('Vintage bike'),
  () =>
    write('possession_create', {
      name: 'Vintage bike',
      acquiredDate: '2019-05-01',
      category: 'Sports',
    }),
);

// Travel
await ensure(
  'journey "Tokyo trip"',
  async () =>
    (await read('travel_journey_list', { query: 'Tokyo', limit: 50 })).includes('Tokyo trip'),
  () =>
    write('travel_journey_create', {
      name: 'Tokyo trip',
      startDate: '2025-04-10',
      endDate: '2025-04-20',
      purpose: 'leisure',
    }),
);

// Finance: one checking account, a few October and yesterday transactions
await ensure(
  'account Checking',
  async () => (await read('finance_accounts', {})).includes('"Checking"'),
  () =>
    write('finance_account_create', {
      name: 'Checking',
      currencyCode: 'USD',
      accountType: 'checking',
    }),
);
const txns: Array<{
  key: string;
  postedOn: string;
  description: string;
  amountCents: number;
  category?: string;
}> = [
  {
    key: 'Whole Foods 1',
    postedOn: '2026-10-05',
    description: 'Whole Foods',
    amountCents: -8450,
    category: 'Groceries',
  },
  {
    key: 'Whole Foods 2',
    postedOn: '2026-10-19',
    description: 'Whole Foods',
    amountCents: -6230,
    category: 'Groceries',
  },
  {
    key: "Trader Joe's",
    postedOn: '2026-10-12',
    description: "Trader Joe's",
    amountCents: -5410,
    category: 'Groceries',
  },
  {
    key: 'Ramen House',
    postedOn: '2026-10-22',
    description: 'Ramen House',
    amountCents: -3200,
    category: 'Dining',
  },
  {
    key: 'Blue Bottle 1',
    postedOn: '2026-11-15',
    description: 'Blue Bottle Coffee',
    amountCents: -575,
    category: 'Dining',
  },
  {
    key: 'Blue Bottle 2',
    postedOn: '2026-11-15',
    description: 'Blue Bottle Coffee',
    amountCents: -575,
    category: 'Dining',
  },
];
for (const t of txns) {
  await ensure(
    `transaction ${t.key}`,
    async () => {
      const found = await read('finance_transaction_search', { query: t.description, limit: 50 });
      return found.includes(t.postedOn) && found.includes(String(Math.abs(t.amountCents) / 100));
    },
    () =>
      write('finance_transaction_upsert', {
        postedOn: t.postedOn,
        account: 'Checking',
        description: t.description,
        amountCents: t.amountCents,
        currencyCode: 'USD',
        category: t.category,
        source: 'eval-seed',
        externalId: `eval-seed-${t.key.replace(/\W+/g, '-').toLowerCase()}`,
      }),
  );
}

// A Dining budget so "am I over budget on dining" has something to compare against.
function findCategoryId(node: unknown, name: string): string | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findCategoryId(item, name);
      if (hit) return hit;
    }
    return undefined;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.name === name && typeof obj.id === 'string') return obj.id;
    for (const value of Object.values(obj)) {
      const hit = findCategoryId(value, name);
      if (hit) return hit;
    }
  }
  return undefined;
}
const diningId = findCategoryId(JSON.parse(await read('finance_categories', {})), 'Dining');
if (!diningId) throw new Error('Dining category not found; transactions should have created it');
// Budgets need a primary currency; setting it again is harmless.
await ensure(
  'primary currency USD',
  async () => false,
  () => write('finance_primary_currency_set', { currencyCode: 'USD' }),
);
await ensure(
  'budget Dining',
  async () => (await read('finance_budget_list', {})).includes(diningId),
  () =>
    write('finance_budget_create', {
      categoryId: diningId,
      amountCents: 20000,
      cadence: 'monthly',
    }),
);

console.log(log.join('\n'));
