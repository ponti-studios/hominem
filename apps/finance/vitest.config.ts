import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    devOptions: {
      enabled: false,
    },
  })],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['**/node_modules/**', '**/build/**', 'tests/**'],
  },
})
