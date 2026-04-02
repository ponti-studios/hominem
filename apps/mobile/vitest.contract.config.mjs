import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

import { mobileVitestBase, mobileVitestResolve } from './vitest.shared.mjs'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: mobileVitestResolve,
  test: {
    ...mobileVitestBase,
    include: ['tests/contracts/*.contract.test.ts'],
    setupFiles: ['./tests/setup/base.ts'],
  },
})
