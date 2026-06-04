import { describe, expect, it } from 'vitest';

import { resolveUploadMimeType, validateFile } from '@hominem/storage';

const PDF_RESUME_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf'],
} as const;

function file(name: string, type: string): File {
  return new File(['content'], name, { type });
}

describe('upload policy validation', () => {
  it('accepts a pdf filename when the MIME type is missing', () => {
    expect(validateFile(file('resume.pdf', ''), PDF_RESUME_VALIDATION)).toEqual({
      valid: true,
    });
    expect(resolveUploadMimeType(file('resume.pdf', ''))).toBe('application/pdf');
  });

  it('accepts a pdf filename when multipart parsing uses application/octet-stream', () => {
    expect(validateFile(file('resume.pdf', 'application/octet-stream'), PDF_RESUME_VALIDATION)).toEqual({
      valid: true,
    });
    expect(resolveUploadMimeType(file('resume.pdf', 'application/octet-stream'))).toBe(
      'application/pdf',
    );
  });

  it('rejects non-pdf files when the MIME type is missing', () => {
    expect(validateFile(file('resume.txt', ''), PDF_RESUME_VALIDATION)).toEqual({
      valid: false,
      error: 'File type not allowed. Allowed types: application/pdf',
    });
  });

  it('rejects files with a wrong MIME type even when the extension is pdf', () => {
    expect(validateFile(file('resume.pdf', 'text/plain'), PDF_RESUME_VALIDATION)).toEqual({
      valid: false,
      error: 'File type not allowed. Allowed types: application/pdf',
    });
  });
});
