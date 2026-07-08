import { defineConfig } from 'vitest/config';

// Match monorepo test DB (see Claude.md / justfiles/db.just).
// Prefer explicit env, then fall back so `just test-api` works without exporting vars.
const DEFAULT_TEST_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:4433/app-test';

const testDatabaseUrl =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || DEFAULT_TEST_DATABASE_URL;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_TEST: testDatabaseUrl,
    },
    include: ['src/finance*.test.ts', 'src/finance.*.test.ts'],
    // Integration suites import @hominem/db at load time; fail loudly if the
    // pool cannot be created rather than hanging on empty file matches.
    fileParallelism: false,
  },
});
