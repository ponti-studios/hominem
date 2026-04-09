import React from 'react'
import { screen } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

jest.mock('~/constants', () => ({
  API_BASE_URL: 'http://localhost:4040',
}))

import { ApiConnectionProvider, ApiReconnectChip } from '~/api/api-connection'

import { renderScreen } from './support/render'

describe('api connection monitor', () => {
  it('renders without crashing', () => {
    renderScreen(
      <ApiConnectionProvider>
        <ApiReconnectChip />
      </ApiConnectionProvider>,
    )
  })

  it('ApiReconnectChip returns null', () => {
    renderScreen(<ApiReconnectChip />)
    expect(screen.toJSON()).toBeNull()
  })
})