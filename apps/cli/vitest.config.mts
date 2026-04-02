import 'dotenv/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    clearMocks: true,
  },
})
