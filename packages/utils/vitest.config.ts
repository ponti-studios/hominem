import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/use-api-client.ts'],
      reporter: ['text'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
