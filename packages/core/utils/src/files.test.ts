import { describe, expect, it } from 'vitest';

import { buildStoredFileName, formatTimestampForFileName, getExtensionFromMimeType, getFileExtension, sanitizeFileName } from './files';

describe('file helpers', () => {
  it('extracts file extensions safely', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg');
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
    expect(getFileExtension('no-extension')).toBeNull();
    expect(getFileExtension('.env')).toBeNull();
  });

  it('sanitizes file names and builds stored names', () => {
    expect(sanitizeFileName('my file (final).png')).toBe('my_file__final_.png');
    expect(buildStoredFileName('abc', 'my file', '.png')).toBe('abc-my_file.png');
    expect(buildStoredFileName('abc', 'my file.png', '.png')).toBe('abc-my_file.png');
  });

  it('formats timestamps for file names', () => {
    expect(formatTimestampForFileName(new Date('2026-05-04T21:00:00.123Z'))).toBe(
      '2026-05-04T21-00-00-123Z',
    );
  });

  it('resolves extension from MIME type', () => {
    expect(getExtensionFromMimeType('image/jpeg')).toBe('.jpg');
    expect(getExtensionFromMimeType('application/pdf')).toBe('.pdf');
    expect(getExtensionFromMimeType('text/csv')).toBe('.csv');
    expect(getExtensionFromMimeType('application/csv')).toBe('.csv');
    expect(getExtensionFromMimeType('audio/mpeg')).toBe('.mp3');
    expect(getExtensionFromMimeType('video/mp4')).toBe('.mp4');
    expect(getExtensionFromMimeType('IMAGE/JPEG')).toBe('.jpg');
    expect(getExtensionFromMimeType('application/unknown')).toBe('');
  });
});
