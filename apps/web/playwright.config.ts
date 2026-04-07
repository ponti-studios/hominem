import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiDir = path.join(workspaceRoot, 'services/api');
const webDir = path.join(workspaceRoot, 'apps/web');
const isCI = process.env.CI === 'true';
const reuseExistingServer = process.env.REUSE_SERVERS === 'true';
const apiBaseUrl = process.env.VITE_PUBLIC_API_URL ?? 'http://localhost:4040';
const apiRootUrl = new URL('/', apiBaseUrl).toString();
const apiPort = new URL(apiBaseUrl).port || '4040';
const apiServerCommand = isCI
  ? `cd ${apiDir} && bun run start`
  : `bun run --filter @hominem/db db:migrate && bun run --filter @hominem/db build && cd ${apiDir} && bun run dev`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4445',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: apiServerCommand,
      cwd: workspaceRoot,
      url: apiRootUrl,
      reuseExistingServer,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: apiPort,
        API_URL: apiBaseUrl,
        NOTES_URL: 'http://localhost:4445',
        DATABASE_URL: 'postgres://postgres:postgres@localhost:4433/hominem-test',
        AUTH_TEST_OTP_ENABLED: 'true',
        AUTH_E2E_SECRET: 'otp-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
        SEND_EMAILS: 'false',
      },
    },
    {
      command: `cd ${webDir} && bun run build && bun run start`,
      cwd: workspaceRoot,
      url: 'http://localhost:4445/logo.web.png',
      reuseExistingServer,
      timeout: 120_000,
      env: {
        PORT: '4445',
        VITE_PUBLIC_API_URL: apiBaseUrl,
      },
    },
  ],
});
