import { afterEach, describe, expect, it } from 'vitest';

import { documentStorageService, fileStorageService } from './r2-storage';

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

describe('direct upload (quarantine then finalize)', () => {
  const owner = 'intent-owner';
  const other = 'intent-other';
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  // In test mode the service is backed by the in-memory store; narrow to its file map.
  if (!('files' in fileStorageService) || !(fileStorageService.files instanceof Map)) {
    throw new Error('expected in-memory storage in tests');
  }
  const backend = { files: fileStorageService.files };

  const land = (key: string, bytes: Buffer) => backend.files.set(key, bytes);

  it('puts uploads in a per-user quarantine key with no user-supplied name', async () => {
    const intent = await fileStorageService.createUploadIntent(
      { mimetype: 'image/png', size: png.byteLength },
      owner,
    );
    expect(intent.quarantineKey).toBe(`quarantine/users/${owner}/${intent.id}`);
    expect(intent.headers).toEqual({ 'content-type': 'image/png' });
  });

  it('refuses disallowed types and bad sizes at intent time', async () => {
    await expect(
      fileStorageService.createUploadIntent({ mimetype: 'image/svg+xml', size: 10 }, owner),
    ).rejects.toThrow('Unsupported');
    await expect(
      fileStorageService.createUploadIntent({ mimetype: 'image/png', size: 0 }, owner),
    ).rejects.toThrow('size');
    await expect(
      fileStorageService.createUploadIntent(
        { mimetype: 'image/png', size: 11 * 1024 * 1024 },
        owner,
      ),
    ).rejects.toThrow('size');
  });

  it('promotes a verified upload and removes the quarantine copy', async () => {
    const intent = await fileStorageService.createUploadIntent(
      { mimetype: 'image/png', size: png.byteLength },
      owner,
    );
    land(intent.quarantineKey, png);
    const result = await fileStorageService.finalizeUpload({
      id: intent.id,
      userId: owner,
      mimetype: 'image/png',
      size: png.byteLength,
      originalName: 'a.png',
    });
    expect(result).toMatchObject({ ok: true, key: `users/${owner}/chats/${intent.id}` });
    expect(backend.files.has(intent.quarantineKey)).toBe(false);
    expect(backend.files.has(`users/${owner}/chats/${intent.id}`)).toBe(true);
  });

  it('deletes uploads whose bytes do not match, or whose size lies', async () => {
    const liar = await fileStorageService.createUploadIntent(
      { mimetype: 'image/png', size: 4 },
      owner,
    );
    land(liar.quarantineKey, Buffer.from([0x4d, 0x5a, 0x90, 0x00]));
    await expect(
      fileStorageService.finalizeUpload({
        id: liar.id,
        userId: owner,
        mimetype: 'image/png',
        size: 4,
        originalName: 'x.png',
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'content_rejected' });
    expect(backend.files.has(liar.quarantineKey)).toBe(false);

    const sized = await fileStorageService.createUploadIntent(
      { mimetype: 'image/png', size: 99 },
      owner,
    );
    land(sized.quarantineKey, png);
    await expect(
      fileStorageService.finalizeUpload({
        id: sized.id,
        userId: owner,
        mimetype: 'image/png',
        size: 99,
        originalName: 'x.png',
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'size_mismatch' });
  });

  it('cannot finalize someone else’s upload', async () => {
    const intent = await fileStorageService.createUploadIntent(
      { mimetype: 'image/png', size: png.byteLength },
      owner,
    );
    land(intent.quarantineKey, png);
    await expect(
      fileStorageService.finalizeUpload({
        id: intent.id,
        userId: other,
        mimetype: 'image/png',
        size: png.byteLength,
        originalName: 'a.png',
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'missing' });
  });
});

describe('signing stored urls', () => {
  it('signs urls that point at our storage and leaves everything else alone', async () => {
    const signed = await fileStorageService.signStoredUrl('/files/users/u1/chats/abc.png', {
      mimetype: 'image/png',
    });
    expect(signed).toContain('users/u1/chats/abc.png');
    expect(signed).toContain('ttl=300');

    const external = 'https://lh3.googleusercontent.com/a/photo';
    expect(await fileStorageService.signStoredUrl(external, { mimetype: 'image/png' })).toBe(
      external,
    );
  });

  it('refuses keys that try to walk out of the bucket path', () => {
    expect(fileStorageService.keyFromStoredUrl('/files/users/u1/../u2/x.png')).toBeNull();
    expect(fileStorageService.keyFromStoredUrl('/files/')).toBeNull();
  });
});

describe('backfill reverify', () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  if (!('files' in fileStorageService) || !(fileStorageService.files instanceof Map)) {
    throw new Error('expected in-memory storage in tests');
  }
  const files = fileStorageService.files;

  it('passes good objects, flags liars, and parks rejects instead of deleting', async () => {
    files.set('users/u/chats/good.png', png);
    files.set('users/u/chats/liar.png', Buffer.from([0x4d, 0x5a, 0x90, 0x00]));

    await expect(
      fileStorageService.reverifyObject('users/u/chats/good.png', 'image/png'),
    ).resolves.toEqual({ ok: true, size: png.byteLength });
    await expect(
      fileStorageService.reverifyObject('users/u/chats/liar.png', 'image/png'),
    ).resolves.toMatchObject({ ok: false, reason: 'content_rejected' });
    await expect(
      fileStorageService.reverifyObject('users/u/chats/gone.png', 'image/png'),
    ).resolves.toEqual({ ok: false, reason: 'missing' });

    await fileStorageService.moveToRejected('users/u/chats/liar.png');
    expect(files.has('users/u/chats/liar.png')).toBe(false);
    expect(files.has('rejected/users/u/chats/liar.png')).toBe(true);
  });
});
