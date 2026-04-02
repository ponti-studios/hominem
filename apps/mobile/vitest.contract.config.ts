import { defineConfig } from 'vitest/config'

import { mobileVitestBase, mobileVitestResolve } from './vitest.shared'

export default defineConfig({
  resolve: mobileVitestResolve,
  test: {
    ...mobileVitestBase,
    include: ['tests/contracts/*.contract.test.ts'],
    setupFiles: ['./tests/setup/base.ts'],
  },
})
