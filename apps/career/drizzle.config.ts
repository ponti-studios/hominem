import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './app/lib/db/schema.ts',
  out: './app/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.VITE_DATABASE_URL || process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
})
