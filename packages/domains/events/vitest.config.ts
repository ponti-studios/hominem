import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5434/hominem',
    },
  },
})
