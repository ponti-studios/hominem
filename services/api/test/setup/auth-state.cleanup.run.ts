import { pool } from '@hakumi/db'
import { redis } from '@hakumi/services/redis'

import { cleanupApiAuthRedisState, cleanupApiAuthTestState } from './auth-state.cleanup'

try {
  await cleanupApiAuthTestState()
  await cleanupApiAuthRedisState()
} finally {
  redis.disconnect()
  await pool.end()
}
