import { defineConfig } from 'vitest/config'

import { mobileVitestBase, mobileVitestResolve } from './vitest.shared'

export default defineConfig({
  resolve: mobileVitestResolve,
  test: {
    ...mobileVitestBase,
    include: [
      'lib/*.test.ts',
      'tests/*.test.ts',
      'tests/components/*.test.ts',
      'utils/**/*.test.ts',
    ],
    setupFiles: ['./tests/setup/base.ts'],
  },
})
