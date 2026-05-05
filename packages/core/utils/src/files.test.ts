import { describe, expect, it } from 'vitest';

import { buildStoredFileName, formatTimestampForFileName, getFileExtension, sanitizeFileName } from './files';

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
});
