import { describe, expect, it } from 'vitest';

import {
  FILE_VALIDATION_PRESETS,
  resolveUploadMimeType,
  validateFile,
} from './storage.service';

function file(name: string, type: string): File {
  return new File(['content'], name, { type });
}

describe('career storage validation', () => {
  it('accepts a pdf filename when the MIME type is missing', () => {
    expect(validateFile(file('resume.pdf', ''), FILE_VALIDATION_PRESETS.PDF_RESUME)).toEqual({
      valid: true,
    });
    expect(resolveUploadMimeType(file('resume.pdf', ''))).toBe('application/pdf');
  });

  it('rejects non-pdf files when the MIME type is missing', () => {
    expect(validateFile(file('resume.txt', ''), FILE_VALIDATION_PRESETS.PDF_RESUME)).toEqual({
      valid: false,
      error: 'File type not allowed. Allowed types: application/pdf',
    });
  });

  it('rejects files with a wrong MIME type even when the extension is pdf', () => {
    expect(validateFile(file('resume.pdf', 'text/plain'), FILE_VALIDATION_PRESETS.PDF_RESUME)).toEqual({
      valid: false,
      error: 'File type not allowed. Allowed types: application/pdf',
    });
  });
});
