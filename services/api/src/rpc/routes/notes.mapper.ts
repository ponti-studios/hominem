import type { NoteRecord } from '@hominem/db/notes';

import { signFileUrl } from './file-urls';

export async function toNoteDto(record: NoteRecord) {
  const files = await Promise.all(
    record.files.map(async (file) => ({
      id: file.id,
      originalName: file.originalName,
      mimetype: file.mimetype,
      size: file.size,
      url: await signFileUrl(file.url, file),
      uploadedAt: file.uploadedAt,
      ...(file.content ? { content: file.content } : {}),
      ...(file.textContent ? { textContent: file.textContent } : {}),
      ...(file.metadata ? { metadata: file.metadata } : {}),
    })),
  );
  return {
    id: record.id,
    userId: record.userId,
    kind: record.kind,
    title: record.title,
    content: record.content,
    excerpt: record.excerpt,
    files,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
