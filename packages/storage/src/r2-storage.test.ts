import { afterEach, describe, expect, it } from 'vitest';

import { documentStorageService } from './r2-storage';

const userId = 'storage-test-user';

afterEach(async () => {
  for (const file of await documentStorageService.listUserFiles(userId)) {
    const fileId = file.name.slice(0, 36);
    await documentStorageService.deleteFile(fileId, userId);
  }
});

describe('document storage', () => {
  it('stores, lists, reads, and deletes a document in test storage', async () => {
    const contents = Buffer.from('test resume');
    const stored = await documentStorageService.storeFile(contents, 'application/pdf', userId, {
      originalName: 'resume.pdf',
    });

    expect((await documentStorageService.listUserFiles(userId)).map((file) => file.name)).toEqual([
      stored.filename.split('/').at(-1),
    ]);
    await expect(documentStorageService.getFile(stored.id, userId)).resolves.toEqual(
      contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength),
    );
    await expect(documentStorageService.deleteFile(stored.id, userId)).resolves.toBe(true);
    await expect(documentStorageService.listUserFiles(userId)).resolves.toEqual([]);
  });
});
