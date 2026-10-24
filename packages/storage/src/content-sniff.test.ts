import { describe, expect, it } from 'vitest';

import { isInlineSafe, sniffContent } from './content-sniff';

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');

describe('sniffContent', () => {
  it('accepts bytes that match the declared type', async () => {
    expect(await sniffContent(PNG, 'image/png')).toEqual({ ok: true, detected: 'image/png' });
    expect(await sniffContent(PDF, 'application/pdf')).toEqual({
      ok: true,
      detected: 'application/pdf',
    });
  });

  it('rejects a lie about the type', async () => {
    expect((await sniffContent(PNG, 'application/pdf')).ok).toBe(false);
    expect((await sniffContent(EXE, 'image/png')).ok).toBe(false);
    expect((await sniffContent(PDF, 'image/jpeg')).ok).toBe(false);
  });

  it('rejects empty uploads', async () => {
    expect(await sniffContent(new Uint8Array(), 'image/png')).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('accepts real text and csv', async () => {
    expect((await sniffContent(new TextEncoder().encode('a,b\n1,2\n'), 'text/csv')).ok).toBe(true);
    expect((await sniffContent(new TextEncoder().encode('héllo ✓'), 'text/plain')).ok).toBe(true);
  });

  it('rejects binaries and non-UTF-8 pretending to be text', async () => {
    expect((await sniffContent(EXE, 'text/plain')).ok).toBe(false);
    expect((await sniffContent(PNG, 'text/csv')).ok).toBe(false);
    expect((await sniffContent(Uint8Array.from([0x61, 0x00, 0x62]), 'text/plain')).ok).toBe(false);
    expect((await sniffContent(Uint8Array.from([0xff, 0xfe, 0xfd]), 'text/plain')).ok).toBe(false);
  });

  it('refuses html/script dressed up as an image', async () => {
    expect((await sniffContent(HTML, 'image/png')).ok).toBe(false);
  });

  it('refuses types it does not know', async () => {
    expect((await sniffContent(PNG, 'image/svg+xml')).ok).toBe(false);
  });
});

describe('isInlineSafe', () => {
  it('only renders media inline, never svg or documents', () => {
    expect(isInlineSafe('image/png')).toBe(true);
    expect(isInlineSafe('audio/mpeg')).toBe(true);
    expect(isInlineSafe('image/svg+xml')).toBe(false);
    expect(isInlineSafe('application/pdf')).toBe(false);
    expect(isInlineSafe('text/plain')).toBe(false);
  });
});
