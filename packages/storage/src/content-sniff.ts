import { fileTypeFromBuffer } from 'file-type';

// How many leading bytes we pull from storage to identify a file. Magic numbers all live in the
// first few KB; text files are checked on this window too.
export const SNIFF_BYTES = 4100;

// Declared mimetype -> what the bytes are allowed to actually be.
// Types with a magic number must match one. Plain-text types must have NO magic number at all
// (so an exe or zip can't ride in as a .txt) and must look like UTF-8 text.
const BINARY_EXPECTATIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/gif': ['image/gif'],
  'image/webp': ['image/webp'],
  'application/pdf': ['application/pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  // Legacy .doc is an OLE compound file; file-type reports the container, not "Word".
  'application/msword': ['application/x-cfb', 'application/msword'],
  'audio/mpeg': ['audio/mpeg'],
  'audio/wav': ['audio/vnd.wave', 'audio/wav', 'audio/x-wav'],
  'audio/ogg': ['audio/ogg'],
  'video/mp4': ['video/mp4'],
  'video/webm': ['video/webm'],
};

const TEXT_TYPES = new Set(['text/plain', 'text/csv', 'application/csv']);

export type SniffResult = { ok: true; detected: string | null } | { ok: false; reason: string };

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    // fatal: true throws on invalid UTF-8. A cut multibyte char at the window edge is fine,
    // so we let the decoder stream.
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

export async function sniffContent(bytes: Uint8Array, declaredMime: string): Promise<SniffResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, reason: 'empty' };
  }

  const detected = await fileTypeFromBuffer(bytes);
  const detectedMime = detected?.mime ?? null;

  if (TEXT_TYPES.has(declaredMime)) {
    if (detectedMime) {
      return { ok: false, reason: `text file is actually ${detectedMime}` };
    }
    return looksLikeText(bytes)
      ? { ok: true, detected: null }
      : { ok: false, reason: 'text file is not valid UTF-8' };
  }

  const expected = BINARY_EXPECTATIONS[declaredMime];
  if (!expected) {
    return { ok: false, reason: `unsupported type ${declaredMime}` };
  }
  if (!detectedMime || !expected.includes(detectedMime)) {
    return {
      ok: false,
      reason: `declared ${declaredMime} but content is ${detectedMime ?? 'unknown'}`,
    };
  }
  return { ok: true, detected: detectedMime };
}

// Only these render inline when served. Everything else is forced to download, so a browser
// never interprets an uploaded file as a page.
const INLINE_SAFE_PREFIXES = ['image/', 'audio/', 'video/'];

export function isInlineSafe(mimetype: string): boolean {
  return (
    INLINE_SAFE_PREFIXES.some((prefix) => mimetype.startsWith(prefix)) && !mimetype.includes('svg')
  );
}
