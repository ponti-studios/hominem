import { pool } from '@hominem/db'
import { redis } from '@hominem/services/redis'

import { cleanupApiAuthRedisState, cleanupApiAuthTestState } from './auth-state.cleanup'

try {
  await cleanupApiAuthTestState()
  await cleanupApiAuthRedisState()
} finally {
  redis.disconnect()
  await pool.end()
}
