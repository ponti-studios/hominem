import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/build/**', '**/dist/**', 'tests/**', '**/*.spec.ts'],
  },
});
