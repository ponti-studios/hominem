import React from 'react'
import { screen } from '@testing-library/react-native'

import NotesFeedScreen from '../../app/(protected)/(tabs)/notes/index'
import { renderScreen } from '../support/render'

const mockUseNoteFeed = jest.fn()

jest.mock('@shopify/flash-list', () => {
  const React = require('react')

  return {
    FlashList: React.forwardRef(({ data = [], renderItem }: any, _ref: unknown) =>
      React.createElement(
        'View',
        null,
        data.map((item: any, index: number) => renderItem({ item, index })),
      ),
    ),
  }
})

jest.mock('react-native-reanimated', () => {
  const React = require('react')
  const { View } = require('react-native')

  const transitionBuilder = {
    duration: () => transitionBuilder,
  }

  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component: typeof View) => Component,
    },
    FadeIn: transitionBuilder,
    FadeOut: transitionBuilder,
    LinearTransition: transitionBuilder,
  }
})

jest.mock('~/services/notes/use-note-stream', () => ({
  flattenNoteFeedPages: (data: { pages: Array<{ notes: unknown[] }> } | undefined) =>
    data?.pages.flatMap((page) => page.notes) ?? [],
  useNoteFeed: () => mockUseNoteFeed(),
}))

jest.mock('~/lib/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

describe('notes feed screen', () => {
  beforeEach(() => {
    mockUseNoteFeed.mockReset()
  })

  it('renders the empty notes state on the dedicated notes route', () => {
    mockUseNoteFeed.mockReturnValue({
      data: { pages: [], pageParams: [] },
      isLoading: false,
      isRefetching: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    })

    renderScreen(<NotesFeedScreen />, {
      pathname: '/(protected)/(tabs)/notes',
      params: {},
    })

    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByText('Start with a thought')).toBeTruthy()
  })
})
