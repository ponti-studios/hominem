import { documentStorageService, type FileObject } from '@hominem/storage';

import type { AccountDocumentFile } from './types';

const UUID_PREFIX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-|\.|$)/i;

export function parseStoredDocument(entry: FileObject): AccountDocumentFile {
  const match = UUID_PREFIX.exec(entry.name);
  const id = match?.[1] ?? entry.name;
  const remainder = match ? entry.name.slice(match[0].length).replace(/^\./, '') : entry.name;
  // Bare `{uuid}.pdf` leaves only the extension as remainder — show a friendly label.
  const displayName =
    !remainder || /^(pdf|docx?|txt)$/i.test(remainder) ? 'Uploaded resume.pdf' : remainder;

  return {
    id,
    name: entry.name,
    displayName,
    size: entry.size,
    lastModified: entry.lastModified ? entry.lastModified.toISOString() : null,
  };
}

export async function listUserDocuments(userId: string): Promise<AccountDocumentFile[]> {
  const files = await documentStorageService.listUserFiles(userId);
  return files.map(parseStoredDocument).sort((a, b) => {
    const aTime = a.lastModified ? Date.parse(a.lastModified) : 0;
    const bTime = b.lastModified ? Date.parse(b.lastModified) : 0;
    return bTime - aTime;
  });
}

export async function deleteUserDocument(userId: string, fileId: string): Promise<boolean> {
  return documentStorageService.deleteFile(fileId, userId);
}
