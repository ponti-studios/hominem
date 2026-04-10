import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: '@hominem/api-unit',
    fileParallelism: false,
    deps: {
      interopDefault: true,
    },
    globals: true,
    environment: 'node',
    setupFiles: './test/test.setup.unit.ts',
    clearMocks: true,
    slowTestThreshold: 250,
    include: [
      'src/application/notes.service.test.ts',
      'src/auth/test-otp-store.test.ts',
      'src/routes/auth-helpers.test.ts',
      'src/middleware/auth.test.ts',
      'src/middleware/request-logger.test.ts',
      'src/workers/file-processing.test.ts',
      'src/rpc/routes/chats.test.ts',
      'src/rpc/routes/files.test.ts',
      'src/rpc/routes/notes.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/build/**'],
  },
});
