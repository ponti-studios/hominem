import type { NoteRecord } from '@hominem/db';
import type { Note, NoteFeedItem, NoteFile } from '@hominem/rpc/types/notes.types';

export function toNoteDto(record: NoteRecord): Note {
  return {
    id: record.id,
    userId: record.userId,
    type: 'note',
    status: 'draft',
    title: record.title,
    content: record.content,
    excerpt: record.excerpt,
    tags: [],
    mentions: [],
    analysis: null,
    publishingMetadata: null,
    parentNoteId: record.parentNoteId,
    files: record.files.map(
      (file): NoteFile => ({
        id: file.id,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        url: file.url,
        uploadedAt: file.uploadedAt,
        ...(file.content ? { content: file.content } : {}),
        ...(file.textContent ? { textContent: file.textContent } : {}),
        ...(file.metadata ? { metadata: file.metadata } : {}),
      }),
    ),
    versionNumber: 1,
    isLatestVersion: true,
    publishedAt: null,
    scheduledFor: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toNoteFeedItemDto(record: {
  id: string;
  title: string | null;
  contentPreview: string;
  createdAt: string;
  authorId: string;
  metadata: { hasAttachments: boolean };
}): NoteFeedItem {
  return {
    id: record.id,
    title: record.title,
    contentPreview: record.contentPreview,
    createdAt: record.createdAt,
    authorId: record.authorId,
    metadata: {
      hasAttachments: record.metadata.hasAttachments,
    },
  };
}
