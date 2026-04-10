import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:4433/hominem-test',
    },
  },
});
