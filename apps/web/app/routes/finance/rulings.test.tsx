import { describe, expect, it } from 'vitest';

import { loader } from './rulings';

describe('Rulings compatibility route', () => {
  it('redirects the old destination to Transactions', async () => {
    const response = await loader();
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/finance/transactions');
  });
});
