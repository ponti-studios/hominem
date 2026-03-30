import Module from 'node:module';

import * as reactNativeMock from './__mocks__/react-native';
(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'react-native') {
    return reactNativeMock;
  }

  if (request.endsWith('.png')) {
    return request;
  }

  return originalLoad.call(this, request, parent, isMain);
};
