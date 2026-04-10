const { cleanup } = require('@testing-library/react-native')
require('./msw-mock')
const { mswServer } = require('../support/msw-server')

require('./mocks-native')
require('./mocks-ui')

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'error' })
})

afterEach(async () => {
  mswServer.resetHandlers()
  await cleanup()
  jest.clearAllMocks()
  jest.useRealTimers()
  const { resetMockRouter } = require('../support/router')
  resetMockRouter()
})

afterAll(() => {
  mswServer.close()
})
