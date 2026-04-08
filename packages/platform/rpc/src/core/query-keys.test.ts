import { describe, expect, it } from 'vitest'
import { queryKeys } from './query-keys'

describe('queryKeys', () => {
  describe('notes', () => {
    it('has stable all key', () => {
      expect(queryKeys.notes.all).toEqual(['notes'])
    })

    it('generates list keys with options', () => {
      expect(queryKeys.notes.list()).toEqual(['notes', 'list', {}])
      expect(queryKeys.notes.list({ status: 'draft' })).toEqual(['notes', 'list', { status: 'draft' }])
      expect(queryKeys.notes.feed()).toEqual(['notes', 'feed', {}])
      expect(queryKeys.notes.feed({ cursor: 'abc' })).toEqual(['notes', 'feed', { cursor: 'abc' }])
    })

    it('generates detail keys', () => {
      expect(queryKeys.notes.detail('note-123')).toEqual(['notes', 'detail', 'note-123'])
    })

    it('generates search keys', () => {
      expect(queryKeys.notes.search('hello')).toEqual(['notes', 'search', 'hello'])
    })
  })

  describe('chats', () => {
    it('has stable all and list keys', () => {
      expect(queryKeys.chats.all).toEqual(['chats'])
      expect(queryKeys.chats.list).toEqual(['chats', 'list'])
    })

    it('generates detail keys', () => {
      expect(queryKeys.chats.detail('chat-456')).toEqual(['chats', 'detail', 'chat-456'])
    })

    it('generates messages keys with default limit', () => {
      expect(queryKeys.chats.messages('chat-456')).toEqual(['chats', 'messages', { chatId: 'chat-456', limit: 50 }])
    })

    it('generates messages keys with custom limit', () => {
      expect(queryKeys.chats.messages('chat-456', 100)).toEqual(['chats', 'messages', { chatId: 'chat-456', limit: 100 }])
    })

    it('has stable sessions and archived keys', () => {
      expect(queryKeys.chats.sessions).toEqual(['chats', 'sessions'])
      expect(queryKeys.chats.archived).toEqual(['chats', 'archived'])
    })
  })

  describe('files', () => {
    it('has stable keys', () => {
      expect(queryKeys.files.all).toEqual(['files'])
      expect(queryKeys.files.list).toEqual(['files', 'list'])
    })

    it('generates detail keys', () => {
      expect(queryKeys.files.detail('file-789')).toEqual(['files', 'detail', 'file-789'])
    })
  })

  describe('key uniqueness', () => {
    it('produces different keys for different entities', () => {
      const noteDetail = queryKeys.notes.detail('123')
      const chatDetail = queryKeys.chats.detail('123')
      expect(noteDetail).not.toEqual(chatDetail)
    })
  })
})
