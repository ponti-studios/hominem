import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const isCI = process.env.CI === 'true';
const reuseExistingServer = process.env.REUSE_SERVERS === 'true';
const apiServerCommand = isCI
  ? 'bun run --filter @hominem/api start'
  : 'bun run --filter @hominem/db db:migrate && bun run --filter @hominem/db build && bun run --filter @hominem/api dev';

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
      url: 'http://localhost:4040/',
      reuseExistingServer,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: '4040',
        API_URL: 'http://localhost:4040',
        NOTES_URL: 'http://localhost:4445',
        DATABASE_URL: 'postgres://postgres:postgres@localhost:4433/hominem-test',
        AUTH_TEST_OTP_ENABLED: 'true',
        AUTH_E2E_SECRET: 'otp-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
        SEND_EMAILS: 'false',
      },
    },
    {
      command: 'bun run --filter @hominem/web build && bun run --filter @hominem/web start',
      cwd: workspaceRoot,
      url: 'http://localhost:4445/logo.web.png',
      reuseExistingServer,
      timeout: 120_000,
      env: {
        PORT: '4445',
        VITE_PUBLIC_API_URL: 'http://localhost:4040',
      },
    },
  ],
});
