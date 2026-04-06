import { pool } from '@hominem/db'

import { cleanupApiAuthRedisState, cleanupApiAuthTestState } from '../setup/auth-state.cleanup'

async function main() {
  await cleanupApiAuthTestState()
  await cleanupApiAuthRedisState()

  await pool.end()

  try {
    const { redis } = await import('@hominem/services/redis')
    await redis.quit()
  } catch {
    // ignore
  }
}

await main()
