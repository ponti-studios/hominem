import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'

import { InputProvider, useInputContext } from '../../components/input/input-context'

let mockCurrentPathname = '/'
let mockCurrentParams: Record<string, string> = {}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockCurrentParams,
  usePathname: () => mockCurrentPathname,
}))

interface Snapshot {
  targetKey: string
  targetKind: string
  message: string
  selectedNoteIds: string[]
}

let snapshot: Snapshot | null = null
let setMessageRef: ((value: string) => void) | null = null
let toggleSelectedNoteIdRef: ((noteId: string) => void) | null = null

function Probe() {
  const { message, selectedNoteIds, setMessage, target, toggleSelectedNoteId } = useInputContext()

  snapshot = {
    targetKey: target.key,
    targetKind: target.kind,
    message,
    selectedNoteIds,
  }
  setMessageRef = setMessage
  toggleSelectedNoteIdRef = toggleSelectedNoteId

  return null
}

describe('mobile composer draft persistence', () => {
  beforeEach(() => {
    mockCurrentPathname = '/'
    mockCurrentParams = {}
    snapshot = null
    setMessageRef = null
    toggleSelectedNoteIdRef = null
  })

  it('preserves the feed draft when leaving and returning', async () => {
    const rendered = render(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await act(() => {
      setMessageRef?.('Feed draft that should survive')
    })

    mockCurrentPathname = '/(protected)/(tabs)/chat/chat-1'
    mockCurrentParams = { id: 'chat-1' }
    rendered.rerender(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    mockCurrentPathname = '/'
    mockCurrentParams = {}
    rendered.rerender(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await waitFor(() => {
      expect(snapshot).toEqual({
        targetKey: 'feed',
        targetKind: 'feed',
        message: 'Feed draft that should survive',
        selectedNoteIds: [],
      })
    })
  })

  it('isolates drafts and note-chip selections per chat id', async () => {
    mockCurrentPathname = '/(protected)/(tabs)/chat/chat-1'
    mockCurrentParams = { id: 'chat-1' }

    const rendered = render(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await act(() => {
      setMessageRef?.('Chat one')
      toggleSelectedNoteIdRef?.('note-1')
    })

    mockCurrentPathname = '/(protected)/(tabs)/chat/chat-2'
    mockCurrentParams = { id: 'chat-2' }
    rendered.rerender(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await waitFor(() => {
      expect(snapshot).toEqual({
        targetKey: 'chat:chat-2',
        targetKind: 'chat',
        message: '',
        selectedNoteIds: [],
      })
    })

    await act(() => {
      setMessageRef?.('Chat two')
    })

    mockCurrentPathname = '/(protected)/(tabs)/chat/chat-1'
    mockCurrentParams = { id: 'chat-1' }
    rendered.rerender(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await waitFor(() => {
      expect(snapshot).toEqual({
        targetKey: 'chat:chat-1',
        targetKind: 'chat',
        message: 'Chat one',
        selectedNoteIds: ['note-1'],
      })
    })
  })

  it('isolates note append drafts per note id', async () => {
    mockCurrentPathname = '/(protected)/(tabs)/notes/note-1'
    mockCurrentParams = { id: 'note-1' }

    const rendered = render(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await act(() => {
      setMessageRef?.('Append to note one')
    })

    mockCurrentPathname = '/(protected)/(tabs)/notes/note-2'
    mockCurrentParams = { id: 'note-2' }
    rendered.rerender(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await waitFor(() => {
      expect(snapshot?.message).toBe('')
    })

    mockCurrentPathname = '/(protected)/(tabs)/notes/note-1'
    mockCurrentParams = { id: 'note-1' }
    rendered.rerender(
      <InputProvider>
        <Probe />
      </InputProvider>,
    )

    await waitFor(() => {
      expect(snapshot).toEqual({
        targetKey: 'note:note-1',
        targetKind: 'note',
        message: 'Append to note one',
        selectedNoteIds: [],
      })
    })
  })
})
