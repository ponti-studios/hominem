import React from 'react'
import { act, fireEvent, render, type RenderAPI } from '@testing-library/react-native'

import { resetMockRouter, setMockPathname, setMockSearchParams } from './router'

export function resetRenderTestState() {
  jest.clearAllMocks()
  jest.useRealTimers()
  resetMockRouter()
}

export function renderScreen(
  ui: React.ReactElement,
  options: {
    pathname?: string
    params?: Record<string, unknown>
  } = {},
): RenderAPI {
  setMockPathname(options.pathname ?? '/')
  setMockSearchParams(options.params ?? {})
  return render(ui)
}

export async function press(element: React.ComponentProps<typeof fireEvent> extends never ? never : Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element)
    await Promise.resolve()
  })
}

export async function changeText(
  element: Parameters<typeof fireEvent.changeText>[0],
  value: string,
) {
  await act(async () => {
    fireEvent.changeText(element, value)
    await Promise.resolve()
  })
}

export async function advanceTimersByTime(durationMs: number) {
  await act(async () => {
    jest.advanceTimersByTime(durationMs)
    await Promise.resolve()
  })
}

export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}
