import type { Note } from '@hominem/rpc/types/notes.types';
import {
  ComposerProvider,
  ComposerStore,
  resolveComposerActions,
  formatNoteAttachmentsSection,
  formatUploadedFileContext,
} from '@hominem/ui/composer';
import type { UploadedFile } from '@hominem/ui/types/upload';
import { render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createNoteFixture(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    userId: 'user-1',
    type: 'note',
    status: 'draft',
    title: 'Context',
    content: 'Body copy',
    excerpt: 'Body copy',
    tags: [],
    mentions: null,
    analysis: null,
    publishingMetadata: null,
    parentNoteId: null,
    versionNumber: 1,
    isLatestVersion: true,
    publishedAt: null,
    scheduledFor: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createUploadedFileFixture(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: 'upload-1',
    originalName: 'brief.pdf',
    type: 'document',
    mimetype: 'application/pdf',
    size: 512,
    content: 'Quarterly brief',
    url: 'https://example.test/brief.pdf',
    uploadedAt: new Date(),
    ...overrides,
  };
}

describe('composer attachments helpers', () => {
  it('formats uploaded file context for chat submission', () => {
    const context = formatUploadedFileContext([createUploadedFileFixture()]);

    expect(context).toContain('Attached files context:');
    expect(context).toContain('Attachment: brief.pdf');
    expect(context).toContain('Quarterly brief');
  });

  it('formats note attachment blocks for note content', () => {
    const content = formatNoteAttachmentsSection([createUploadedFileFixture()]);

    expect(content).toContain('## Attachments');
    expect(content).toContain('- [brief.pdf](https://example.test/brief.pdf)');
  });
});

describe('resolveComposerActions', () => {
  const mocks = {
    createNote: vi.fn<() => Promise<void>>(),
    updateNote: vi.fn<() => Promise<void>>(),
    sendMessage: vi.fn<() => Promise<void>>(),
    createChat: vi.fn<() => Promise<{ id: string }>>(),
    clearDraft: vi.fn(),
    clearAttachedNotes: vi.fn(),
    clearUploadedFiles: vi.fn(),
    navigate: vi.fn(),
    runWithSubmitLock: vi.fn<(task: () => Promise<void>) => Promise<void>>(async (task) => {
      await task();
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps capture primary to note creation', async () => {
    mocks.createNote.mockResolvedValue();

    const actions = resolveComposerActions({
      posture: 'capture',
      draftText: 'Hello',
      noteId: null,
      noteTitle: null,
      chatId: null,
      attachedNotes: [],
      uploadedFiles: [],
      isUploadingAttachments: false,
      isSubmitting: false,
      ...mocks,
    });

    await actions.primary.execute();

    expect(mocks.createNote).toHaveBeenCalledWith({ content: 'Hello', title: 'Hello' });
    expect(mocks.clearDraft).toHaveBeenCalledTimes(1);
    expect(mocks.runWithSubmitLock).toHaveBeenCalledTimes(1);
  });

  it('maps draft secondary to note discussion chat creation', async () => {
    mocks.createChat.mockResolvedValue({ id: 'chat-1' });

    const actions = resolveComposerActions({
      posture: 'draft',
      draftText: 'Help me think through this',
      noteId: 'note-1',
      noteTitle: 'Roadmap',
      chatId: null,
      attachedNotes: [],
      uploadedFiles: [],
      isUploadingAttachments: false,
      isSubmitting: false,
      ...mocks,
    });

    await actions.secondary.execute();

    expect(mocks.createChat).toHaveBeenCalledWith({
      title: 'Help me think through this',
      seedText: '[Regarding note: "Roadmap"]\n\nHelp me think through this',
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/chat/chat-1');
    expect(mocks.clearDraft).toHaveBeenCalledTimes(1);
  });

  it('maps reply primary to chat send with note context and cleanup', async () => {
    mocks.sendMessage.mockResolvedValue();

    const actions = resolveComposerActions({
      posture: 'reply',
      draftText: 'Question',
      noteId: null,
      noteTitle: null,
      chatId: 'chat-1',
      attachedNotes: [createNoteFixture()],
      uploadedFiles: [],
      isUploadingAttachments: false,
      isSubmitting: false,
      ...mocks,
    });

    await actions.primary.execute();

    expect(mocks.sendMessage).toHaveBeenCalledWith({
      chatId: 'chat-1',
      message: '<context>\n### Context\n\nBody copy\n</context>\n\nQuestion',
    });
    expect(mocks.clearDraft).toHaveBeenCalledTimes(1);
    expect(mocks.clearAttachedNotes).toHaveBeenCalledTimes(1);
  });

  it('adds uploaded file context to reply send actions', async () => {
    mocks.sendMessage.mockResolvedValue();

    const actions = resolveComposerActions({
      posture: 'reply',
      draftText: 'Question',
      noteId: null,
      noteTitle: null,
      chatId: 'chat-1',
      attachedNotes: [],
      uploadedFiles: [createUploadedFileFixture()],
      isUploadingAttachments: false,
      isSubmitting: false,
      ...mocks,
    });

    await actions.primary.execute();

    expect(mocks.sendMessage).toHaveBeenCalledWith({
      chatId: 'chat-1',
      message: expect.stringContaining('Attached files context:'),
    });
    expect(mocks.clearUploadedFiles).toHaveBeenCalledTimes(1);
  });
});
