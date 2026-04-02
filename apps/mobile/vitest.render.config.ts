import { defineConfig } from 'vitest/config'

import { mobileVitestBase, mobileVitestResolve } from './vitest.shared'

export default defineConfig({
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
