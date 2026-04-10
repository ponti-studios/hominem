import { test as base, expect } from '@playwright/test';

import { getAuthenticatedStorageState } from './auth.session-helpers';
import { createAuthTestEmail } from './auth.shared';

export const test = base.extend<{ authEmail: string }>({
  authEmail: async ({}, use, testInfo) => {
    await use(createAuthTestEmail(testInfo.titlePath.join('-')));
  },
  context: async ({ browser, playwright, authEmail }, use) => {
    const request = await playwright.request.newContext();

    try {
      const storageState = await getAuthenticatedStorageState(request, authEmail);
      const authenticatedContext = await browser.newContext({ storageState });

      try {
        await use(authenticatedContext);
      } finally {
        await authenticatedContext.close();
      }
    } finally {
      await request.dispose();
    }
  },
});

export { expect };
