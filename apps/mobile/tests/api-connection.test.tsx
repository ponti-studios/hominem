import React from 'react'
import { screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

jest.mock('~/utils/constants', () => ({
  API_BASE_URL: 'http://localhost:4040',
}))

import { ApiConnectionProvider, ApiReconnectChip } from '~/utils/api-connection'

import { advanceTimersByTime, press, renderScreen } from './support/render'

function FireApiRequest() {
  return (
    <Pressable
      testID="api-request"
      onPress={() => {
        void fetch('http://localhost:4040/api/notes').catch(() => undefined)
      }}
    >
      <Text>Ping</Text>
    </Pressable>
  )
}

describe('api connection monitor', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    fetchSpy = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('shows a reconnecting chip and retries every 10 seconds until the api recovers', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    renderScreen(
      <ApiConnectionProvider>
        <ApiReconnectChip />
      </ApiConnectionProvider>,
    )

    expect(await screen.findByTestId('api-reconnect-chip')).toBeTruthy()
    expect(screen.getByText('Warming up the API · retrying in 10s')).toBeTruthy()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await advanceTimersByTime(10_000)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('api-reconnect-chip')).toBeNull()
    })
  })

  it('stays quiet when the api is healthy', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }))

    renderScreen(
      <ApiConnectionProvider>
        <ApiReconnectChip />
      </ApiConnectionProvider>,
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByTestId('api-reconnect-chip')).toBeNull()
  })

  it('turns on the reconnect chip after a failed api request and keeps polling', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    renderScreen(
      <ApiConnectionProvider>
        <FireApiRequest />
        <ApiReconnectChip />
      </ApiConnectionProvider>,
    )

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByTestId('api-reconnect-chip')).toBeNull()

    await press(screen.getByTestId('api-request'))

    await waitFor(() => {
      expect(screen.getByTestId('api-reconnect-chip')).toBeTruthy()
    })

    await advanceTimersByTime(10_000)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(4)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('api-reconnect-chip')).toBeNull()
    })
  })
})
