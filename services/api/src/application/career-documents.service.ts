import { documentStorageService, type FileObject } from '@hominem/storage';
import { logger } from '@hominem/telemetry';

const UUID_PREFIX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-|\.|$)/i;

export interface CareerDocument {
  id: string;
  name: string;
  displayName: string;
  size: number;
  lastModified: string | null;
}

export function parseStoredDocument(entry: FileObject): CareerDocument {
  const match = UUID_PREFIX.exec(entry.name);
  const id = match?.[1] ?? entry.name;
  const remainder = match ? entry.name.slice(match[0].length).replace(/^\./, '') : entry.name;
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

/** Documents the user uploaded directly to document storage (resumes and similar). */
export async function listCareerDocuments(ownerUserId: string): Promise<CareerDocument[]> {
  try {
    const files = await documentStorageService.listUserFiles(ownerUserId);
    return files.map(parseStoredDocument).sort((left, right) => {
      const leftTime = left.lastModified ? Date.parse(left.lastModified) : 0;
      const rightTime = right.lastModified ? Date.parse(right.lastModified) : 0;
      return rightTime - leftTime;
    });
  } catch (error) {
    // Document storage is optional for the profile page: a misconfigured or
    // temporarily unreachable bucket should not block the rest of the profile
    // (the standalone app degraded the same way).
    logger.error('career_documents_list_failed', {
      owner_userid: ownerUserId,
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return [];
  }
}

export async function deleteCareerDocument(ownerUserId: string, fileId: string) {
  return documentStorageService.deleteFile(fileId, ownerUserId);
}

export async function storeCareerDocument(ownerUserId: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await documentStorageService.storeFile(buffer, file.type, ownerUserId, {
    originalName: file.name,
  });
  return { id: stored.id, url: stored.url, name: file.name, size: file.size };
}
