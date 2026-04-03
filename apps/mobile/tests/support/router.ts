import * as ExpoRouter from 'expo-router'

type RouterMockModule = typeof ExpoRouter & {
  __getRouterSpies: () => {
    push: jest.Mock
    replace: jest.Mock
  }
  __resetRouter: () => void
  __setPathname: (pathname: string) => void
  __setSearchParams: (params: Record<string, unknown>) => void
}

const routerMock = ExpoRouter as RouterMockModule

export function resetMockRouter() {
  routerMock.__resetRouter()
}

export function setMockPathname(pathname: string) {
  routerMock.__setPathname(pathname)
}

export function setMockSearchParams(params: Record<string, unknown>) {
  routerMock.__setSearchParams(params)
}

export const routerSpies = routerMock.__getRouterSpies()
