import Module from 'node:module'
import { afterEach, vi } from 'vitest'

import * as reactNativeMock from '../__mocks__/react-native'

const originalLoad = Module._load

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'react-native') {
    return reactNativeMock
  }

  if (typeof request === 'string' && request.endsWith('.png')) {
    return request
  }

  return originalLoad.call(this, request, parent, isMain)
}

const { cleanup } = await import('@testing-library/react-native')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
