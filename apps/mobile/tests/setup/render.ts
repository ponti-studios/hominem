import Module from 'node:module'
import React from 'react'
import { afterEach, vi } from 'vitest'

import * as reactNativeMock from '../__mocks__/react-native'

const originalLoad = Module._load
const svgComponent = ({ children, ...props }) => React.createElement('Svg', props, children)
const reactNativeSvgMock = new Proxy(
  {
    __esModule: true,
    default: svgComponent,
    Svg: svgComponent,
  },
  {
    get(target, property) {
      if (property in target) {
        return target[property]
      }

      return svgComponent
    },
  },
)

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'react-native') {
    return reactNativeMock
  }

  if (request === 'react-native-svg') {
    return reactNativeSvgMock
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
