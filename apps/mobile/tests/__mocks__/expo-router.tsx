import React from 'react'

const routerSpies = {
  push: jest.fn(),
  replace: jest.fn(),
}

let pathname = '/'
let searchParams: Record<string, unknown> = {}

export function __setPathname(nextPathname: string) {
  pathname = nextPathname
}

export function __setSearchParams(nextSearchParams: Record<string, unknown>) {
  searchParams = nextSearchParams
}

export function __getRouterSpies() {
  return routerSpies
}

export function __resetRouter() {
  pathname = '/'
  searchParams = {}
  routerSpies.push.mockReset()
  routerSpies.replace.mockReset()
}

export function Link({ children }: { children: React.ReactNode }) {
  return children
}

export function Redirect({ href }: { href: string }) {
  return href
}

export function useLocalSearchParams<T extends Record<string, unknown> = Record<string, unknown>>() {
  return searchParams as T
}

export function usePathname() {
  return pathname
}

export function useRouter() {
  return routerSpies
}
