import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const isCI = process.env.CI === 'true';
const reuseExistingServer = process.env.REUSE_SERVERS === 'true';
const apiBaseUrl = process.env.VITE_PUBLIC_API_URL ?? 'http://localhost:4040';
const apiRootUrl = new URL('/', apiBaseUrl).toString();
const apiPort = new URL(apiBaseUrl).port || '4040';
const apiServerCommand = isCI ? 'just web-e2e-api-ci' : 'just web-e2e-api-local';
const webServerCommand = isCI ? 'just web-e2e-web-ci' : 'just web-e2e-web-local';

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
        AUTH_E2E_SECRET: process.env.AUTH_E2E_SECRET ?? 'otp-secret',
        OPENROUTER_API_KEY: 'test-openrouter-key',
        SEND_EMAILS: 'false',
        RESEND_API_KEY: process.env.RESEND_API_KEY ?? 're_placeholder',
        RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
        RESEND_FROM_NAME: process.env.RESEND_FROM_NAME ?? 'Test',
      },
    },
    {
      command: webServerCommand,
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
