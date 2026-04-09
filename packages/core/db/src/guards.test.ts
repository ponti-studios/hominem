import { describe, expect, it } from 'vitest';

import {
  isChatMessageFileRecord,
  isChatMessageToolCallRecord,
  parseChatMessageFiles,
  parseChatMessageToolCalls,
} from './guards';

describe('isChatMessageFileRecord', () => {
  it('returns true for valid image file record', () => {
    const valid = {
      type: 'image',
      fileId: 'file-123',
      url: 'https://example.com/image.png',
      filename: 'image.png',
      mimeType: 'image/png',
      size: 1024,
    };
    expect(isChatMessageFileRecord(valid)).toBe(true);
  });

  it('returns true for valid file record', () => {
    const valid = {
      type: 'file',
      fileId: 'file-456',
      url: 'https://example.com/doc.pdf',
    };
    expect(isChatMessageFileRecord(valid)).toBe(true);
  });

  it('returns true for record with metadata', () => {
    const valid = {
      type: 'file',
      metadata: { extractedText: 'some text' },
    };
    expect(isChatMessageFileRecord(valid)).toBe(true);
  });

  it('returns false for invalid type', () => {
    const invalid = { type: 'video', fileId: 'file-123' };
    expect(isChatMessageFileRecord(invalid)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isChatMessageFileRecord(null)).toBe(false);
  });

  it('returns false for primitive', () => {
    expect(isChatMessageFileRecord('string')).toBe(false);
    expect(isChatMessageFileRecord(123)).toBe(false);
  });

  it('returns false for object with wrong field types', () => {
    const invalid = { type: 'image', size: 'not-a-number' };
    expect(isChatMessageFileRecord(invalid)).toBe(false);
  });

  it('returns false for object with invalid metadata', () => {
    const invalid = { type: 'image', metadata: 'not-an-object' };
    expect(isChatMessageFileRecord(invalid)).toBe(false);
  });
});

describe('isChatMessageToolCallRecord', () => {
  it('returns true for valid tool call record', () => {
    const valid = {
      toolName: 'get_weather',
      type: 'tool-call',
      toolCallId: 'call-123',
      args: { city: 'London', unit: 'celsius' },
    };
    expect(isChatMessageToolCallRecord(valid)).toBe(true);
  });

  it('returns false for missing toolName', () => {
    const invalid = {
      type: 'tool-call',
      toolCallId: 'call-123',
      args: {},
    };
    expect(isChatMessageToolCallRecord(invalid)).toBe(false);
  });

  it('returns false for wrong type', () => {
    const invalid = {
      toolName: 'get_weather',
      type: 'not-tool-call',
      toolCallId: 'call-123',
      args: {},
    };
    expect(isChatMessageToolCallRecord(invalid)).toBe(false);
  });

  it('returns false for args with non-string values', () => {
    const invalid = {
      toolName: 'get_weather',
      type: 'tool-call',
      toolCallId: 'call-123',
      args: { count: 42 },
    };
    expect(isChatMessageToolCallRecord(invalid)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isChatMessageToolCallRecord(null)).toBe(false);
  });
});

describe('parseChatMessageFiles', () => {
  it('returns array for valid files', () => {
    const input = [
      { type: 'image', url: 'https://example.com/img.png' },
      { type: 'file', url: 'https://example.com/doc.pdf' },
    ];
    expect(parseChatMessageFiles(input)).toEqual(input);
  });

  it('returns null for non-array', () => {
    expect(parseChatMessageFiles(null)).toBeNull();
    expect(parseChatMessageFiles('string')).toBeNull();
    expect(parseChatMessageFiles({})).toBeNull();
  });

  it('returns null if any item is invalid', () => {
    const input = [
      { type: 'image', url: 'https://example.com/img.png' },
      { type: 'video', url: 'https://example.com/vid.mp4' },
    ];
    expect(parseChatMessageFiles(input)).toBeNull();
  });

  it('returns empty array for empty array', () => {
    expect(parseChatMessageFiles([])).toEqual([]);
  });
});

describe('parseChatMessageToolCalls', () => {
  it('returns array for valid tool calls', () => {
    const input = [
      { toolName: 'tool1', type: 'tool-call', toolCallId: 'call-1', args: { a: '1' } },
      { toolName: 'tool2', type: 'tool-call', toolCallId: 'call-2', args: { b: '2' } },
    ];
    expect(parseChatMessageToolCalls(input)).toEqual(input);
  });

  it('returns null for non-array', () => {
    expect(parseChatMessageToolCalls(null)).toBeNull();
    expect(parseChatMessageToolCalls('string')).toBeNull();
  });

  it('returns null if any item is invalid', () => {
    const input = [
      { toolName: 'tool1', type: 'tool-call', toolCallId: 'call-1', args: { a: '1' } },
      { toolName: 'tool2', type: 'wrong', toolCallId: 'call-2', args: {} },
    ];
    expect(parseChatMessageToolCalls(input)).toBeNull();
  });

  it('returns empty array for empty array', () => {
    expect(parseChatMessageToolCalls([])).toEqual([]);
  });
});
