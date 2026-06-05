import { defineConfig } from 'vitest/config'

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@127.0.0.1:4433/app-test';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_URL_TEST: TEST_DATABASE_URL,
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx,js,jsx}'],

    clearMocks: true,
    coverage: {
      provider: 'v8',
      clean: true,
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
      reporter: ['lcov'],
      reportsDirectory: 'coverage',
    },
  },
})
