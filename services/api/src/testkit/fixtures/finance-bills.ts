import { callTool } from '../../mcp/tool-registry';

const ENERGY_BILL = {
  name: 'Octopus Energy',
  kind: 'electricity',
  paymentMethod: 'direct_debit',
  amountModel: 'variable',
  currencyCode: 'GBP',
  cadence: 'monthly',
  dueDay: 15,
  merchantMatch: ['octopus energy'],
};

/** Creates a bill through the MCP tool; override whatever the case cares about. */
export function createEnergyBill(userId: string, overrides: Record<string, unknown> = {}) {
  return callTool(userId, 'finance_bill_create', { ...ENERGY_BILL, ...overrides });
}
