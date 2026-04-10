import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateVoiceResponse, VoiceError } from './voice-response.service';
import {
  installVoiceFetchMock,
  makeVoiceAudioStreamResponse,
  makeVoiceErrorResponse,
  makeVoiceSampleAudioBase64,
  mockVoiceEnv,
  mockVoiceFetch,
} from './voice-test-helpers';

vi.mock('./env', () => ({
  get env() {
    return mockVoiceEnv;
  },
}));
installVoiceFetchMock();

const mockEnv = mockVoiceEnv;
const mockFetch = mockVoiceFetch;
const makeAudioStreamResponse = makeVoiceAudioStreamResponse;
const makeErrorResponse = makeVoiceErrorResponse;
const SAMPLE_AUDIO_B64 = makeVoiceSampleAudioBase64();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateVoiceResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.OPENROUTER_API_KEY = 'test-openrouter-key';
  });

  // -- Happy path -----------------------------------------------------------

  it('returns audioBuffer, mimeType, and transcript on success', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['Hello there!']));

    const result = await generateVoiceResponse({ text: 'Hi' });

    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    expect(result.audioBuffer.length).toBeGreaterThan(0);
    expect(result.transcript).toBe('Hello there!');
    expect(result.mimeType).toBe('audio/pcm'); // default format is pcm16
  });

  it('concatenates multiple audio and transcript chunks', async () => {
    const part1 = Buffer.from('part1').toString('base64');
    const part2 = Buffer.from('part2').toString('base64');

    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([part1, part2], ['Hello ', 'world']));

    const result = await generateVoiceResponse({ text: 'Hi' });

    expect(result.transcript).toBe('Hello world');
    // The implementation joins base64 strings then decodes once — verify
    // the resulting buffer decodes from the joined base64 string
    const joinedB64 = part1 + part2;
    const expected = Buffer.from(joinedB64, 'base64');
    expect(result.audioBuffer).toEqual(expected);
  });

  it('defaults to alloy voice and pcm16 format', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'test' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.audio.voice).toBe('alloy');
    expect(body.audio.format).toBe('pcm16');
  });

  it('forwards custom voice to API (format always pcm16 for streaming)', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'test', voice: 'nova' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.audio.voice).toBe('nova');
    // API always uses pcm16 for streaming regardless of user request
    expect(body.audio.format).toBe('pcm16');
  });

  it('includes systemPrompt as a system message when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'Hi', systemPrompt: 'You are a helpful assistant.' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('omits system message when systemPrompt is not provided', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'Hi' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('calls the OpenRouter chat/completions endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'test' });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('sends the correct model', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'test' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('openai/gpt-4o-audio-preview');
  });

  it('requests both text and audio modalities', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'test' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.modalities).toEqual(['text', 'audio']);
    expect(body.stream).toBe(true);
  });

  it('sends Authorization header with the API key', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([SAMPLE_AUDIO_B64], ['ok']));

    await generateVoiceResponse({ text: 'test' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-openrouter-key',
    );
  });

  // -- Error handling -------------------------------------------------------

  it('throws AUTH when OPENROUTER_API_KEY is missing', async () => {
    mockEnv.OPENROUTER_API_KEY = undefined;

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'AUTH',
      statusCode: 401,
    });
  });

  it('throws AUTH on 401 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized'));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'AUTH',
      statusCode: 401,
    });
  });

  it('throws AUTH on 403 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(403, 'Forbidden'));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'AUTH',
      statusCode: 401,
    });
  });

  it('throws QUOTA on 429 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(429, 'Too Many Requests'));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'QUOTA',
      statusCode: 429,
    });
  });

  it('throws RESPONSE_FAILED on 500 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error'));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'RESPONSE_FAILED',
      statusCode: 500,
    });
  });

  it('throws RESPONSE_FAILED when fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'RESPONSE_FAILED',
      statusCode: 500,
    });
  });

  it('throws RESPONSE_FAILED for non-Error fetch rejections', async () => {
    mockFetch.mockRejectedValueOnce('some string error');

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'RESPONSE_FAILED',
      statusCode: 500,
    });
  });

  it('throws RESPONSE_FAILED when stream returns no audio data', async () => {
    // Stream that delivers transcript but zero audio chunks
    mockFetch.mockResolvedValueOnce(makeAudioStreamResponse([], ['hello']));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toMatchObject({
      code: 'RESPONSE_FAILED',
      statusCode: 500,
    });
  });

  it('all errors are instances of VoiceError', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    await expect(generateVoiceResponse({ text: 'test' })).rejects.toBeInstanceOf(VoiceError);
  });
});
