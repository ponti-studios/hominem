import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getServerEnv } from '../env'
import * as schema from './schema'

const serverEnv = getServerEnv()

// Export client for use in scripts like seed or migrate for explicit connection management
// Using max: 1 is a common practice for command-line scripts.
export const client = postgres(serverEnv.VITE_DATABASE_URL, { max: 1 })

// Main database connection with better pooling and timeout settings
const sql = postgres(serverEnv.VITE_DATABASE_URL, {
  max: 10, // Maximum number of connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Disable prepared statements for better compatibility
})

export const db = drizzle(sql, { schema })

// Export the schema for use elsewhere
export { schema }

// Re-export everything from the schema
export * from './schema.js'

// Re-export database utilities
export * from './queries/index.js'
