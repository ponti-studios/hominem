import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    env: {
      NODE_ENV: 'test',
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('vitest.setup.ts', import.meta.url))],
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
