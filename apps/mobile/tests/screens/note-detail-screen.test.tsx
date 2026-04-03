import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

import NoteDetailScreen from '../../app/(protected)/(tabs)/notes/[id]'

const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockUpdate = jest.fn()
const mockNote = {
  id: 'note-1',
  title: 'Original title',
  content: 'Original content',
  files: [
    {
      id: 'file-1',
      originalName: 'brief.pdf',
      url: 'https://cdn.example.com/brief.pdf',
    },
  ],
}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'note-1' }),
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}))

jest.mock('../../theme', () => {
  const React = require('react')
  return {
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement('Text', null, children),
    theme: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        'text-secondary': '#999999',
        'text-tertiary': '#777777',
        'border-default': '#333333',
      },
      spacing: {
        sm_12: 12,
        m_16: 16,
      },
      borderRadii: {
        md: 12,
      },
    },
  }
})

jest.mock('../../utils/services/notes/use-note-query', () => ({
  useNoteQuery: () => ({
    data: mockNote,
  }),
}))

jest.mock('@hominem/rpc/react', () => ({
  useApiClient: () => ({
    notes: {
      update: mockUpdate,
    },
  }),
}))

describe('note detail screen', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockReplace.mockReset()
    mockPush.mockReset()
    mockUpdate.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps title and body editing while removing inline media controls', async () => {
    const screen = render(<NoteDetailScreen />)
    const [titleInput, contentInput] = screen.getAllByPlaceholderText(/Untitled note|Start writing.../)

    expect(screen.queryByText('LIBRARY')).toBeNull()
    expect(screen.queryByText('CAMERA')).toBeNull()
    expect(screen.queryByText('VOICE')).toBeNull()

    await act(async () => {
      fireEvent.changeText(titleInput, 'Updated title')
      jest.advanceTimersByTime(450)
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'note-1',
      title: 'Updated title',
      content: 'Original content',
      fileIds: ['file-1'],
    })

    await act(async () => {
      fireEvent.changeText(contentInput, 'Updated content')
      jest.advanceTimersByTime(450)
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'note-1',
      title: 'Updated title',
      content: 'Updated content',
      fileIds: ['file-1'],
    })
  })
})
