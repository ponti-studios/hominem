import { describe, expect, it } from 'vitest';

import {
  CreateNoteInputSchema,
  noteCreateToolInputSchema,
  noteUpdateToolInputSchema,
  UpdateNoteInputSchema,
} from './notes.schema';

describe('note create schemas', () => {
  it('REST and MCP enforce the same title/content rules', () => {
    for (const schema of [CreateNoteInputSchema, noteCreateToolInputSchema]) {
      expect(schema.parse({ content: 'oat milk, coffee' })).toMatchObject({
        content: 'oat milk, coffee',
      });
      expect(() => schema.parse({ content: '' })).toThrow();
      expect(() => schema.parse({ content: '  ' })).toThrow();
      expect(() => schema.parse({ title: '', content: 'hi' })).toThrow();
      expect(() => schema.parse({ content: 'x'.repeat(50001) })).toThrow();
      expect(() => schema.parse({ title: 'x'.repeat(201), content: 'hi' })).toThrow();
    }
  });

  it('only REST accepts file attachments', () => {
    expect(CreateNoteInputSchema.parse({ content: 'hi', fileIds: [] }).fileIds).toEqual([]);
    expect(noteCreateToolInputSchema.safeParse({ content: 'hi', fileIds: [] }).success).toBe(
      true, // unknown keys are ignored by default zod objects, not rejected
    );
  });
});

describe('note update schemas', () => {
  it('REST and MCP both reject a patch with nothing to change', () => {
    expect(() => UpdateNoteInputSchema.parse({})).toThrow();
    expect(() =>
      noteUpdateToolInputSchema.parse({ id: '11111111-1111-4111-8111-111111111111' }),
    ).toThrow();
  });

  it('allows REST attachment-only updates while MCP requires note content fields', () => {
    expect(UpdateNoteInputSchema.parse({ fileIds: [] }).fileIds).toEqual([]);
    expect(
      noteUpdateToolInputSchema.safeParse({
        id: '11111111-1111-4111-8111-111111111111',
        fileIds: [],
      }).success,
    ).toBe(false);
  });

  it('REST and MCP both reject an empty title or oversized content', () => {
    expect(() => UpdateNoteInputSchema.parse({ title: '' })).toThrow();
    expect(() =>
      noteUpdateToolInputSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        title: '',
      }),
    ).toThrow();
    expect(() => UpdateNoteInputSchema.parse({ content: 'x'.repeat(50001) })).toThrow();
  });

  it('both allow clearing the title with null', () => {
    expect(UpdateNoteInputSchema.parse({ title: null }).title).toBeNull();
    expect(
      noteUpdateToolInputSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        title: null,
      }).title,
    ).toBeNull();
  });
});
