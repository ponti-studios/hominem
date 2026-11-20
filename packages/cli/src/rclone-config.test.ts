import { describe, expect, it } from 'vitest';

import { upsertRcloneRemote } from './rclone-config.js';

describe('upsertRcloneRemote', () => {
  it('creates the file when there is none', () => {
    expect(upsertRcloneRemote('', 'gdrive', { type: 'drive', token: 't' })).toBe(
      '[gdrive]\ntype = drive\ntoken = t\n',
    );
  });

  it('appends a new section and keeps the other remotes', () => {
    const out = upsertRcloneRemote('[s3]\ntype = s3\n', 'gdrive', { token: 't' });
    expect(out).toBe('[s3]\ntype = s3\n\n[gdrive]\ntoken = t\n');
  });

  it('updates existing keys, adds missing ones, and leaves unrelated keys and sections alone', () => {
    const conf = '[gdrive]\ntype = drive\nteam_drive = abc\ntoken = old\n\n[s3]\ntoken = keep\n';
    const out = upsertRcloneRemote(conf, 'gdrive', { token: 'new', client_id: 'id' });
    expect(out).toBe(
      '[gdrive]\ntype = drive\nteam_drive = abc\ntoken = new\nclient_id = id\n\n[s3]\ntoken = keep\n',
    );
  });

  it('is idempotent', () => {
    const once = upsertRcloneRemote('[gdrive]\ntoken = old\n', 'gdrive', { token: 'new' });
    expect(upsertRcloneRemote(once, 'gdrive', { token: 'new' })).toBe(once);
  });
});
