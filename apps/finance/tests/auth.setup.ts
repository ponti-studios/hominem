import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { createOtpTestEmail, signInWithOtp } from '@ponti-studios/auth/testkit';

const authDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.auth');
const authStorageState = path.join(authDir, 'finance-user.json');

test('authenticate finance e2e user', async ({ page }) => {
  await mkdir(authDir, { recursive: true });
  await signInWithOtp(page, createOtpTestEmail('finance-setup'), /\/finance$/);
  await page.context().storageState({ path: authStorageState });
});
