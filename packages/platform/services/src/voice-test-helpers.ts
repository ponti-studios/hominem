import { Buffer } from 'node:buffer';

import { vi } from 'vitest';

export const mockVoiceEnv = {
  OPENROUTER_API_KEY: 'test-openrouter-key' as string | undefined,
};

export const mockVoiceFetch = vi.fn();

export function installVoiceEnvMock(modulePath: string) {
  vi.mock(modulePath, () => ({
    get env() {
      return mockVoiceEnv;
    },
  }));
}

export function installVoiceFetchMock() {
  vi.stubGlobal('fetch', mockVoiceFetch);
}

export function makeVoiceAudioStreamResponse(
  audioChunks: string[],
  transcriptChunks: string[],
  status = 200,
) {
  const lines: string[] = [];

  for (let i = 0; i < Math.max(audioChunks.length, transcriptChunks.length); i++) {
    const audio: Record<string, string> = {};
    if (audioChunks[i]) audio.data = audioChunks[i];
    if (transcriptChunks[i]) audio.transcript = transcriptChunks[i];
    lines.push(`data: ${JSON.stringify({ choices: [{ delta: { audio } }] })}\n`);
  }
  lines.push('data: [DONE]\n');

  const body = lines.join('\n');
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(body);

  let pos = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (pos < uint8.length) {
        controller.enqueue(uint8.slice(pos, pos + 64));
        pos += 64;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    body: stream,
    json: vi.fn().mockResolvedValue({}),
  };
}

export function makeVoiceErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    statusText: message,
    body: null,
    json: vi.fn().mockResolvedValue({ error: { message } }),
  };
}

export function makeVoiceAudioBuffer(bytes = 1024): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

export function makeVoiceSampleAudioBase64() {
  return Buffer.from('RIFF....fake-audio-data').toString('base64');
}
