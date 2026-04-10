import { describe, expect, it } from 'vitest';

import type { Note } from '@hominem/rpc/types';

import {
  buildChatTitle,
  buildNoteContent,
  canSubmitComposerDraft,
  getUploadedAttachmentIds,
  mergeNoteIntoCache,
  mergeUniqueIds,
  resolveComposerPrimaryAction,
  resolveComposerSecondaryAction,
} from '~/components/input/composer-actions';

describe('composer actions', () => {
  it('resolves primary actions by route target', () => {
    expect(resolveComposerPrimaryAction('chat')).toBe('send_chat');
    expect(resolveComposerPrimaryAction('note')).toBe('append_note');
    expect(resolveComposerPrimaryAction('feed')).toBe('create_note');
    expect(resolveComposerPrimaryAction('notes')).toBe('create_note');
    expect(resolveComposerPrimaryAction('hidden')).toBeNull();
  });

  it('resolves secondary actions by route target', () => {
    expect(resolveComposerSecondaryAction('feed')).toBe('create_chat');
    expect(resolveComposerSecondaryAction('chat')).toBeNull();
    expect(resolveComposerSecondaryAction('note')).toBeNull();
  });

  it('derives uploaded attachment ids from uploaded files only', () => {
    expect(
      getUploadedAttachmentIds([
        { id: 'local-1', name: 'Local', type: 'image' },
        { id: 'file-1', name: 'Remote', type: 'image', uploadedFile: { id: 'file-1' } } as never,
      ]),
    ).toEqual(['file-1']);
  });

  it('flags when a draft can submit', () => {
    expect(
      canSubmitComposerDraft({
        isUploading: false,
        message: '  hello  ',
        uploadedAttachmentIds: [],
      }),
    ).toBe(true);

    expect(
      canSubmitComposerDraft({
        isUploading: false,
        message: '   ',
        uploadedAttachmentIds: ['file-1'],
      }),
    ).toBe(true);

    expect(
      canSubmitComposerDraft({
        isUploading: true,
        message: 'hello',
        uploadedAttachmentIds: [],
      }),
    ).toBe(false);
  });

  it('builds chat titles and note content', () => {
    expect(buildChatTitle('   hello world   ')).toBe('hello world');
    expect(buildChatTitle('   ')).toBe('New conversation');
    expect(buildNoteContent('body', ' hello ')).toBe('body\n\nhello');
    expect(buildNoteContent('', ' hello ')).toBe('hello');
    expect(buildNoteContent('body', '   ')).toBe('body');
  });

  it('merges note caches and file ids without duplication', () => {
    const updatedNote = { id: '2' } as Note;
    const currentNotes = [{ id: '1' } as Note, { id: '2' } as Note];

    expect(mergeNoteIntoCache(undefined, updatedNote)).toEqual([updatedNote]);
    expect(mergeNoteIntoCache(currentNotes, updatedNote)).toEqual([{ id: '1' }, updatedNote]);
    expect(mergeUniqueIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
