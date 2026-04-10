import { describe, expect, it } from 'vitest';

import {
  parseUploadResponse,
  parseVoiceTranscribeErrorResponse,
  parseVoiceTranscribeSuccessResponse,
} from './api-response-validation';

describe('api-response-validation', () => {
  it('accepts valid voice transcription responses', () => {
    expect(parseVoiceTranscribeSuccessResponse({ text: 'hello world' })).toEqual({
      text: 'hello world',
    });
  });

  it('rejects invalid voice transcription responses', () => {
    expect(() => parseVoiceTranscribeSuccessResponse({ text: 123 })).toThrow();
    expect(() => parseVoiceTranscribeErrorResponse({ error: 123 })).toThrow();
  });

  it('accepts valid upload responses', () => {
    expect(
      parseUploadResponse({
        success: true,
        file: {
          id: '11111111-1111-4111-8111-111111111111',
          originalName: 'brief.pdf',
          type: 'document',
          mimetype: 'application/pdf',
          size: 12,
          url: 'https://cdn.example/brief.pdf',
          uploadedAt: '2026-03-23T12:00:00.000Z',
        },
        message: 'File uploaded successfully',
      }),
    ).toMatchObject({ success: true });
  });

  it('rejects invalid upload responses', () => {
    expect(() =>
      parseUploadResponse({
        success: true,
        file: { id: 'bad-id' },
        message: 'File uploaded successfully',
      }),
    ).toThrow();
  });
});
