import type { BrowserContext, Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

import { createAuthTestEmail, signInWithEmailOtp } from './auth.flow-helpers';

const API_BASE_URL = process.env.FINANCE_E2E_API_URL ?? 'http://localhost:4040';
const APP_BASE_URL = process.env.FINANCE_E2E_APP_URL ?? 'http://localhost:4444';

function getAuthE2eSecret() {
  const secret = process.env.FINANCE_E2E_AUTH_SECRET ?? process.env.AUTH_E2E_SECRET;
  if (!secret) {
    throw new Error('Missing FINANCE_E2E_AUTH_SECRET or AUTH_E2E_SECRET for finance E2E tests');
  }
  return secret;
}

export type FinanceSeed = {
  ok: boolean;
  userId: string;
  institutionId: string;
  plaidItemId: string;
  accounts: {
    checking: string;
    credit: string;
    savings: string;
  };
  tags: {
    groceries: string;
    rent: string;
    income: string;
    travel: string;
  };
  transactions: {
    salary: string;
    rent: string;
    groceries: string;
    cafe: string;
    flight: string;
    interest: string;
  };
};

type FinanceApi = {
  reset: () => Promise<void>;
  seed: () => Promise<FinanceSeed>;
};

type Fixtures = {
  authenticatedPage: Page;
  financeApi: FinanceApi;
  financeSeed: FinanceSeed;
};

async function callFinanceE2e<T>(page: Page, path: '/reset' | '/seed') {
  const response = await page.request.post(`${API_BASE_URL}/api/finance/e2e${path}`, {
    headers: {
      'x-e2e-auth-secret': getAuthE2eSecret(),
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as T;
}

async function installFinanceApiAuthRoute(context: BrowserContext, userId: string) {
  // Intercept requests to the app domain (proxied through the test page's server)
  await context.route(`${APP_BASE_URL}/api/finance/**`, async (route) => {
    const targetUrl = route.request().url().replace(APP_BASE_URL, API_BASE_URL);
    const headers = {
      ...route.request().headers(),
      'x-e2e-auth-secret': getAuthE2eSecret(),
      'x-user-id': userId,
    };
    const response = await route.fetch({ url: targetUrl, headers });
    await route.fulfill({ response }).catch(() => {});
  });

  // Also intercept direct API calls from the RPC client (cross-origin fetch)
  // to add the x-user-id header for auth when SameSite=Lax blocks session cookies
  await context.route(`${API_BASE_URL}/api/finance/**`, async (route) => {
    const headers = {
      ...route.request().headers(),
      'x-e2e-auth-secret': getAuthE2eSecret(),
      'x-user-id': userId,
    };
    const response = await route.fetch({ url: route.request().url(), headers });
    await route.fulfill({ response }).catch(() => {});
  });
}

export const test = base.extend<Fixtures>({
  context: async ({ browser }, use) => {
    // Each test gets its own browser context so route handlers don't accumulate
    const ctx = await browser.newContext();
    await use(ctx);
    await ctx.close();
  },
  authenticatedPage: async ({ page, context }, use, testInfo) => {
    await context.clearCookies();
    const email = createAuthTestEmail(`finance-${testInfo.project.name}`);
    const userId = crypto.randomUUID();
    await installFinanceApiAuthRoute(context, userId);
    await signInWithEmailOtp(page, email);
    await use(page);
  },
  financeApi: async ({ authenticatedPage }, use) => {
    await use({
      reset: async () => {
        await callFinanceE2e(authenticatedPage, '/reset');
      },
      seed: () => callFinanceE2e<FinanceSeed>(authenticatedPage, '/seed'),
    });
  },
  financeSeed: async ({ financeApi }, use) => {
    const seed = await financeApi.seed();
    await use(seed);
    await financeApi.reset();
  },
});

export { expect } from '@playwright/test';
