import './setup/base.setup'
import './setup/server-mocks.setup'

import { afterEach, beforeEach } from 'vitest'

import { cleanupApiAuthRedisState, cleanupApiAuthTestState } from './setup/auth-state.cleanup'

beforeEach(async () => {
  await cleanupApiAuthTestState()
  await cleanupApiAuthRedisState()
})

afterEach(async () => {
  await cleanupApiAuthTestState()
  await cleanupApiAuthRedisState()
})
