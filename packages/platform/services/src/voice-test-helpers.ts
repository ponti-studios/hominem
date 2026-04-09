import { Buffer } from 'node:buffer';

import { vi } from 'vitest';

export const mockVoiceEnv = {
  OPENROUTER_API_KEY: 'test-openrouter-key' as string | undefined,
};

export const mockVoiceFetch: ReturnType<typeof vi.fn> = vi.fn();

export function installVoiceFetchMock() {
  vi.stubGlobal('fetch', mockVoiceFetch);
}

export function makeVoiceAudioStreamResponse(audioChunks: string[], transcriptChunks: string[], status = 200): { ok: boolean; status: number; statusText: string; body: ReadableStream<Uint8Array>; json: () => Promise<Record<string, unknown>> } {
  const lines: string[] = [];
  for (let i = 0; i < Math.max(audioChunks.length, transcriptChunks.length); i++) {
    const audio: Record<string, string> = {};
    if (audioChunks[i]) audio.data = audioChunks[i] as string;
    if (transcriptChunks[i]) audio.transcript = transcriptChunks[i] as string;
    lines.push(`data: ${JSON.stringify({ choices: [{ delta: { audio } }] })}\n`);
  }
  lines.push('data: [DONE]\n');

  const uint8 = new TextEncoder().encode(lines.join('\n'));
  let pos = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (pos < uint8.length) { c.enqueue(uint8.slice(pos, pos + 64)); pos += 64; }
      else c.close();
    },
  });

  return { ok: status >= 200 && status < 300, status, statusText: status === 200 ? 'OK' : 'Error', body, json: vi.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({}) };
}

export function makeVoiceErrorResponse(status: number, message: string): { ok: false; status: number; statusText: string; body: null; json: () => Promise<{ error: { message: string } }> } {
  return { ok: false, status, statusText: message, body: null, json: vi.fn<() => Promise<{ error: { message: string } }>>().mockResolvedValue({ error: { message } }) };
}

export function makeVoiceAudioBuffer(bytes = 1024): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

export function makeVoiceSampleAudioBase64() {
  return Buffer.from('RIFF....fake-audio-data').toString('base64');
}
