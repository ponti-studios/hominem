import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

import { mobileVitestBase, mobileVitestResolve } from './vitest.shared.mjs'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: mobileVitestResolve,
  test: {
    ...mobileVitestBase,
    include: [
      'tests/routes/*.test.tsx',
      'tests/screens/*.test.tsx',
      'tests/components/*.test.tsx',
    ],
    setupFiles: ['./tests/setup/base.ts', './tests/setup/render.ts'],
  },
})
