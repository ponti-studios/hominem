import { describe, expect, it } from 'vitest'
import {
  CreateNoteInputSchema,
  NotesFeedQuerySchema,
  NotesListQuerySchema,
  UpdateNoteInputSchema,
} from './notes.schema'

describe('CreateNoteInputSchema', () => {
  it('accepts minimal valid input (content only)', () => {
    const result = CreateNoteInputSchema.safeParse({ content: 'Hello world' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('note') // default
      expect(result.data.tags).toEqual([]) // default
    }
  })

  it('accepts full valid input', () => {
    const result = CreateNoteInputSchema.safeParse({
      type: 'journal',
      status: 'draft',
      title: 'My Journal Entry',
      content: 'Today was a good day',
      tags: [{ value: 'personal' }],
      excerpt: 'A brief excerpt',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing content', () => {
    const result = CreateNoteInputSchema.safeParse({ title: 'No content' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid type', () => {
    const result = CreateNoteInputSchema.safeParse({ content: 'test', type: 'invalid_type' })
    expect(result.success).toBe(false)
  })

  it('rejects more than 5 fileIds', () => {
    const result = CreateNoteInputSchema.safeParse({
      content: 'test',
      fileIds: [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000006',
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID fileIds', () => {
    const result = CreateNoteInputSchema.safeParse({
      content: 'test',
      fileIds: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid content types', () => {
    const types = ['note', 'document', 'task', 'timer', 'journal', 'tweet', 'essay', 'blog_post', 'social_post']
    for (const type of types) {
      const result = CreateNoteInputSchema.safeParse({ content: 'test', type })
      expect(result.success).toBe(true)
    }
  })
})

describe('UpdateNoteInputSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateNoteInputSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial updates', () => {
    const result = UpdateNoteInputSchema.safeParse({ title: 'Updated title' })
    expect(result.success).toBe(true)
  })

  it('accepts null for nullable fields', () => {
    const result = UpdateNoteInputSchema.safeParse({ title: null, excerpt: null, tags: null })
    expect(result.success).toBe(true)
  })
})

describe('NotesListQuerySchema', () => {
  it('accepts empty query', () => {
    const result = NotesListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid sort options', () => {
    const result = NotesListQuerySchema.safeParse({ sortBy: 'createdAt', sortOrder: 'desc' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid sortBy', () => {
    const result = NotesListQuerySchema.safeParse({ sortBy: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('all query params are strings (from URL params)', () => {
    const result = NotesListQuerySchema.safeParse({
      types: 'note,journal',
      status: 'draft',
      limit: '10',
      offset: '0',
    })
    expect(result.success).toBe(true)
  })
})

describe('NotesFeedQuerySchema', () => {
  it('accepts empty query', () => {
    const result = NotesFeedQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts cursor-based pagination params', () => {
    const result = NotesFeedQuerySchema.safeParse({
      limit: '20',
      cursor: 'cursor-token',
    })
    expect(result.success).toBe(true)
  })
})
