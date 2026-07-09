import { describe, expect, it } from 'vitest';

import { parseStoredDocument } from '../documents.server';

describe('parseStoredDocument', () => {
  it('extracts uuid id and original display name', () => {
    const parsed = parseStoredDocument({
      name: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890-resume.pdf',
      size: 1200,
      lastModified: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(parsed.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(parsed.displayName).toBe('resume.pdf');
    expect(parsed.size).toBe(1200);
    expect(parsed.lastModified).toBe('2026-01-02T00:00:00.000Z');
  });

  it('handles bare uuid.pdf names', () => {
    const parsed = parseStoredDocument({
      name: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf',
      size: 10,
    });

    expect(parsed.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(parsed.displayName).toBe('Uploaded resume.pdf');
  });
});
