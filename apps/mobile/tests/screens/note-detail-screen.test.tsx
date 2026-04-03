import React from 'react'
import { screen } from '@testing-library/react-native'

import NoteDetailScreen from '../../app/(protected)/(tabs)/notes/[id]'
import { advanceTimersByTime, changeText, renderScreen } from '../support/render'

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

jest.mock('expo-router')

jest.mock('~/utils/services/notes/use-note-query', () => ({
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
    mockUpdate.mockReset().mockResolvedValue(undefined)
  })

  it('keeps title and body editing while removing inline media controls', async () => {
    renderScreen(<NoteDetailScreen />, {
      pathname: '/(protected)/(tabs)/notes/note-1',
      params: { id: 'note-1' },
    })
    const [titleInput, contentInput] = screen.getAllByPlaceholderText(/Untitled note|Start writing.../)

    expect(screen.queryByText('LIBRARY')).toBeNull()
    expect(screen.queryByText('CAMERA')).toBeNull()
    expect(screen.queryByText('VOICE')).toBeNull()

    await changeText(titleInput, 'Updated title')
    await advanceTimersByTime(450)

    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'note-1',
      title: 'Updated title',
      content: 'Original content',
      fileIds: ['file-1'],
    })

    await changeText(contentInput, 'Updated content')
    await advanceTimersByTime(450)

    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'note-1',
      title: 'Updated title',
      content: 'Updated content',
      fileIds: ['file-1'],
    })
  })
})
