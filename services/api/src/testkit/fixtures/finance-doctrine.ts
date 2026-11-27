/** A synthetic doctrine touching every rule family. */
export function doctrineFixture() {
  return {
    version: 1,
    merchantRules: [
      {
        matchMode: 'contains',
        pattern: 'Test Coffee Co',
        category: 'Food',
        note: 'Dated ruling 2026-11-22: kept for the audit trail.',
      },
      { matchMode: 'exact', pattern: 'Example Rail Operator', category: 'Transport' },
    ],
    tagRules: [{ pattern: 'Test Coffee Co', tags: ['Coffee'] }],
    amountRules: [
      {
        merchant: 'Example Subscriptions Ltd',
        amountMinorUnits: [-899],
        category: 'Subscriptions',
      },
    ],
    transferMerchants: [{ matchMode: 'exact', pattern: 'Example Savings Sweep' }],
    incomePatterns: [{ matchMode: 'exact', pattern: 'Example Payroll' }],
    coffeePatterns: ['test coffee'],
    lenses: [
      {
        category: 'Food',
        matches: [{ matchMode: 'contains', pattern: 'Test Coffee', tag: 'Coffee' }],
      },
    ],
  };
}
