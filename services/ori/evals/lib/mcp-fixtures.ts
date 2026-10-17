import { financeSpendingByCategoryOutputSchema } from '../../../api/src/schemas/finance.schema';

export type McpFixtureProfile = {
  ambiguousPerson?: boolean;
  collection?: 'japan' | 'existing' | 'missing';
  responses?: Record<string, ToolOutcome>;
};

type FixtureState = { calls: string[]; fixture: McpFixtureProfile };
type ToolInput = Record<string, unknown>;
export type ToolOutcome = { output: unknown; confirmationRequired?: boolean };

export function executeFixtureTool(
  name: string,
  input: ToolInput,
  state: FixtureState,
): ToolOutcome {
  if (state.calls.includes(name)) return { output: { error: 'duplicate_tool_call', name } };
  state.calls.push(name);
  const override = state.fixture.responses?.[name];
  if (override) return override;
  switch (name) {
    case 'place_visit_history':
      return {
        output: { visits: [{ id: 'visit-1', place: 'Sushi Dai', city: 'Tokyo' }], count: 1 },
      };
    case 'trip_history':
      return {
        output: {
          trips: [
            {
              id: 'trip-tokyo',
              city: 'Tokyo',
              country: 'Japan',
              startDate: '2025-04-10',
              endDate: '2025-04-18',
            },
            {
              id: 'trip-london',
              city: 'London',
              country: 'United Kingdom',
              startDate: '2024-09-02',
              endDate: '2024-09-08',
            },
          ],
          count: 2,
        },
      };
    case 'people_lookup':
      return {
        output: {
          people:
            state.fixture.ambiguousPerson === true
              ? [
                  { id: 'person-alex', name: 'Alex Morgan', email: 'alex@example.com' },
                  { id: 'person-alexis', name: 'Alexis Chen', email: 'alexis@example.com' },
                ]
              : [{ id: 'person-alex', name: 'Alex Morgan', email: 'alex@example.com' }],
          count: state.fixture.ambiguousPerson === true ? 2 : 1,
        },
      };
    case 'person_timeline':
      return {
        output:
          input.personId === 'person-alex'
            ? { personId: 'person-alex', events: [{ type: 'trip', city: 'Tokyo' }] }
            : { error: 'invalid_or_invented_person_id' },
      };
    case 'finance_recent_transactions':
      return {
        output:
          input.from === '2025-04-10' && input.to === '2025-04-18'
            ? {
                transactions: [
                  { id: 'txn-1', postedOn: '2025-04-12', merchant: 'Sushi Dai', amountCents: 4200 },
                ],
                count: 1,
              }
            : { error: 'date_range_must_come_from_trip_history' },
      };
    case 'search_memories':
      return { output: { memories: [], count: 0 } };
    case 'remember':
      return { output: { id: 'memory-aisle', content: input.content, alreadyExists: false } };
    case 'list_collections':
      return {
        output: {
          collections:
            state.fixture.collection === 'japan'
              ? [{ id: 'collection-japan', name: 'Japan restaurants' }]
              : state.fixture.collection === 'missing'
                ? []
                : [{ id: 'collection-existing', name: 'Existing Places' }],
          count: state.fixture.collection === 'missing' ? 0 : 1,
        },
      };
    case 'finance_monthly_stats': {
      const mixed = input.month === '2026-02';
      return {
        output: mixed
          ? {
              month: '2026-02',
              income: null,
              expenses: null,
              net: null,
              transactionCount: 31,
              averageTransaction: null,
              topTag: null,
              topMerchant: null,
              tagSpending: [],
              currencyBreakdown: [
                {
                  currencyCode: 'GBP',
                  income: 2600,
                  expenses: 1800,
                  net: 800,
                  transactionCount: 20,
                  averageTransaction: 90,
                  topTag: 'Food',
                  topMerchant: 'Grocer',
                  tagSpending: [],
                },
                {
                  currencyCode: 'USD',
                  income: 1000,
                  expenses: 500,
                  net: 500,
                  transactionCount: 11,
                  averageTransaction: 45.45,
                  topTag: 'Work',
                  topMerchant: 'Cloud Tools',
                  tagSpending: [],
                },
              ],
              startDate: '2026-02-01',
              endDate: '2026-02-28',
              currencyCode: null,
              warnings: ['Activity spans multiple currencies; combined totals are omitted.'],
            }
          : {
              month: '2026-09',
              income: 4200,
              expenses: 3100,
              net: 1100,
              transactionCount: 42,
              averageTransaction: 73.81,
              topTag: 'Household',
              topMerchant: 'Tesco',
              tagSpending: [],
              currencyBreakdown: [
                {
                  currencyCode: 'GBP',
                  income: 4200,
                  expenses: 3100,
                  net: 1100,
                  transactionCount: 42,
                  averageTransaction: 73.81,
                  topTag: 'Household',
                  topMerchant: 'Tesco',
                  tagSpending: [],
                },
              ],
              startDate: '2026-09-01',
              endDate: '2026-09-30',
              currencyCode: 'GBP',
              warnings: [],
            },
      };
    }
    case 'finance_spending_by_category': {
      const output =
        input.from === '2026-02-01'
          ? {
              from: '2026-02-01',
              to: '2026-02-28',
              currencyCode: null,
              truncated: false,
              categories: [
                {
                  categoryId: 'category-groceries',
                  categoryName: 'Groceries',
                  currencyCode: 'GBP',
                  spent: 420,
                  transactionCount: 6,
                },
                {
                  categoryId: 'category-software',
                  categoryName: 'Software',
                  currencyCode: 'USD',
                  spent: 320,
                  transactionCount: 3,
                },
              ],
              warnings: ['Category amounts are reported separately by currency.'],
            }
          : {
              from: '2026-09-01',
              to: '2026-09-30',
              currencyCode: 'GBP',
              truncated: false,
              categories: [
                {
                  categoryId: 'category-housing',
                  categoryName: 'Housing',
                  currencyCode: 'GBP',
                  spent: 1800,
                  transactionCount: 18,
                },
                {
                  categoryId: 'category-food',
                  categoryName: 'Food',
                  currencyCode: 'GBP',
                  spent: 700,
                  transactionCount: 12,
                },
              ],
              warnings: [],
            };
      return { output: financeSpendingByCategoryOutputSchema.parse(output) };
    }
    case 'finance_top_merchants':
      return {
        output:
          input.from === '2026-02-01'
            ? {
                merchants: [
                  { name: 'Grocer', totalSpent: 420, transactionCount: 6 },
                  { name: 'Cloud Tools', totalSpent: 320, transactionCount: 3 },
                ],
                count: 2,
                currencyCode: null,
                warnings: [
                  'Merchant amounts span multiple currencies; currency per merchant is unavailable.',
                ],
              }
            : {
                merchants: [
                  { name: 'Tesco', totalSpent: 650, transactionCount: 5 },
                  { name: 'Trainline', totalSpent: 250, transactionCount: 2 },
                ],
                count: 2,
                currencyCode: 'GBP',
                warnings: [],
              },
      };
    case 'career_profile':
      return {
        output: {
          roles: [{ title: 'Staff Engineer', company: 'Hominem' }],
          skills: ['TypeScript'],
        },
      };
    case 'career_applications':
      return {
        output: {
          applications: [
            { id: 'application-old', company: 'Acme', title: 'Engineer', status: 'APPLIED' },
          ],
          count: 1,
        },
      };
    case 'create_collection':
    case 'invite_member':
    case 'career_application_delete':
    case 'remove_collection_item':
    case 'finance_transaction_upsert':
    case 'finance_transaction_delete':
    case 'finance_transactions_import':
      return {
        output: { confirmationRequired: true, pendingAction: name },
        confirmationRequired: true,
      };
    default:
      return { output: { error: `unknown_tool:${name}` } };
  }
}
