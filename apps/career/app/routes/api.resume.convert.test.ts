import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCareerTestDb } from '~/test/db/career';
import { makeConvertedResumeData } from '~/test/factories/resume';

const testState = vi.hoisted(() => ({
  authUser: {
    id: 'user-id',
    email: 'user@example.com',
    name: 'Test User',
  } as { id: string; email: string; name: string } | null,
  validationResult: { valid: true } as { valid: boolean; error?: string },
  rateLimitAllowed: true,
  rateLimitRemaining: 2,
  rateLimitResetTime: 1_893_456_000_000,
  pdfText: 'resume text',
  pdfShouldFail: false,
  pdfCalls: 0,
  aiContent: '',
  aiShouldFail: false,
  aiCalls: 0,
  uploadResult: {
    success: true,
    fileId: 'file-id',
    publicUrl: 'http://localhost:9000/storage/resumes/resume.pdf',
  } as { success: boolean; fileId?: string; publicUrl?: string },
  uploadCalls: [] as unknown[][],
  deleteShouldFail: false,
  deleteShouldThrow: false,
  deleteCalls: [] as unknown[][],
  saveResult: {
    portfolioId: 'portfolio-id',
    portfolioSlug: 'charles-ponti',
  },
  saveShouldFail: false,
}));

vi.mock('../lib/auth.server', () => ({
  getAuthenticatedUser: vi.fn(async () => testState.authUser),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../lib/services/storage.service', () => ({
  FILE_VALIDATION_PRESETS: {
    PDF_RESUME: {},
  },
  validateFile: vi.fn(() => testState.validationResult),
  resolveUploadMimeType: vi.fn((file: File) =>
    file.type || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : ''),
  ),
  uploadFile: vi.fn(async (...args: unknown[]) => {
    testState.uploadCalls.push(args);
    return testState.uploadResult;
  }),
  deleteFile: vi.fn(async (...args: unknown[]) => {
    testState.deleteCalls.push(args);
    if (testState.deleteShouldThrow) throw new Error('cleanup threw');
    return testState.deleteShouldFail
      ? { success: false, error: 'cleanup failed' }
      : { success: true };
  }),
}));

vi.mock('../lib/services/resume-conversion.service', () => ({
  saveResumeToDatabase: vi.fn(async () => {
    if (testState.saveShouldFail) throw new Error('db failed');
    return testState.saveResult;
  }),
}));

vi.mock('../lib/services/pdf-text.server', () => ({
  extractPdfText: vi.fn(async () => {
    testState.pdfCalls += 1;
    if (testState.pdfShouldFail) throw new Error('pdf failed');
    return testState.pdfText;
  }),
}));

vi.mock('../lib/rate-limit', () => ({
  resumeConvertRateLimit: {
    maxRequests: 3,
    isAllowed: vi.fn(() => ({
      allowed: testState.rateLimitAllowed,
      remaining: testState.rateLimitRemaining,
      resetTime: testState.rateLimitResetTime,
    })),
  },
  getRateLimitHeaders: vi.fn((result: { remaining: number; resetTime: number }) => ({
    'X-RateLimit-Limit': '3',
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  })),
}));

vi.mock('@hominem/services/ai-model', () => ({
  getSharedAiModelConfig: vi.fn(() => ({ modelId: 'test-model' })),
  getSharedOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => {
          testState.aiCalls += 1;
          if (testState.aiShouldFail) throw new Error('ai failed');
          return { choices: [{ message: { content: testState.aiContent } }] };
        }),
      },
    },
  })),
}));

let action: typeof import('./api.resume.convert').action;
const testDb = createCareerTestDb();

beforeAll(async () => {
  ({ action } = await import('./api.resume.convert'));
});

afterEach(async () => {
  await testDb.cleanup();
});

function pdfFile(): File {
  return new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
}

function pdfFileWithoutMime(): File {
  return new File(['pdf'], 'resume.pdf', { type: '' });
}

function formRequest(file?: File, options?: { replaceExisting?: boolean }): Request {
  const entries = new Map<string, FormDataEntryValue>();
  if (file) entries.set('pdf', file);
  if (options?.replaceExisting) entries.set('replaceExisting', 'true');
  const request = new Request('http://localhost/api/resume/convert', {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data' },
  });

  Object.defineProperty(request, 'formData', {
    value: async () => ({
      get: (key: string) => entries.get(key) ?? null,
    }),
  });

  return request;
}

async function callAction(request: Request): Promise<Response> {
  return (await action({
    request,
    params: {},
    context: {},
    unstable_url: new URL(request.url),
    unstable_pattern: '/api/resume/convert',
  })) as Response;
}

async function responseBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function createExistingPortfolio() {
  const { user, portfolio } = await testDb.createPortfolio({
    slug: 'existing',
    title: 'Existing Portfolio',
  });
  testState.authUser = {
    id: user.id,
    email: user.email,
    name: user.name,
  };
  return portfolio;
}

describe('resume convert action', () => {
  beforeEach(() => {
    testState.authUser = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
    };
    testState.rateLimitAllowed = true;
    testState.rateLimitRemaining = 2;
    testState.rateLimitResetTime = 1_893_456_000_000;
    testState.validationResult = { valid: true };
    testState.pdfText = 'resume text';
    testState.pdfShouldFail = false;
    testState.pdfCalls = 0;
    testState.aiContent = JSON.stringify(makeConvertedResumeData());
    testState.aiShouldFail = false;
    testState.aiCalls = 0;
    testState.uploadResult = {
      success: true,
      fileId: 'file-id',
      publicUrl: 'http://localhost:9000/storage/resumes/resume.pdf',
    };
    testState.uploadCalls = [];
    testState.deleteShouldFail = false;
    testState.deleteShouldThrow = false;
    testState.deleteCalls = [];
    testState.saveResult = {
      portfolioId: 'portfolio-id',
      portfolioSlug: 'charles-ponti',
    };
    testState.saveShouldFail = false;
  });

  it('returns auth stage when the user is not authenticated', async () => {
    testState.authUser = null;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(401);
    expect(body.stage).toBe('auth');
    expect(body.retryable).toBe(false);
  });

  it('returns request stage when the body is not multipart', async () => {
    const response = await callAction(
      new Request('http://localhost/api/resume/convert', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }),
    );
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('request');
  });

  it('returns rate limit stage before parsing multipart requests', async () => {
    testState.rateLimitAllowed = false;
    testState.rateLimitRemaining = 0;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(body.stage).toBe('rate-limit');
    expect(body.rateLimit).toMatchObject({ limit: 3, remaining: 0 });
    expect(testState.pdfCalls).toBe(0);
    expect(testState.aiCalls).toBe(0);
    expect(testState.uploadCalls).toHaveLength(0);
  });

  it('returns file validation stage when no file is attached', async () => {
    const response = await callAction(formRequest());
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('file-validation');
  });

  it('returns file validation stage when file validation fails', async () => {
    testState.validationResult = { valid: false, error: 'Invalid PDF' };

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('file-validation');
    expect(body.error).toBe('Invalid PDF');
  });

  it('returns replace confirmation before extraction when a portfolio exists', async () => {
    await createExistingPortfolio();

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(409);
    expect(body.stage).toBe('replace-confirmation');
    expect(body.existingPortfolio).toEqual({
      slug: 'existing',
      title: 'Existing Portfolio',
    });
    expect(testState.pdfCalls).toBe(0);
    expect(testState.aiCalls).toBe(0);
    expect(testState.uploadCalls).toHaveLength(0);
  });

  it('continues conversion when replacing an existing portfolio is confirmed', async () => {
    await createExistingPortfolio();

    const response = await callAction(formRequest(pdfFile(), { replaceExisting: true }));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body.stage).toBe('complete');
    expect(testState.pdfCalls).toBe(1);
  });

  it('returns pdf extraction stage when text extraction fails', async () => {
    testState.pdfShouldFail = true;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('pdf-extraction');
  });

  it('returns pdf extraction stage when extracted text is empty', async () => {
    testState.pdfText = '   ';

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('pdf-extraction');
  });

  it('returns pdf extraction stage when extracted text is too large', async () => {
    testState.pdfText = 'x'.repeat(80_001);

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('pdf-extraction');
    expect(testState.aiCalls).toBe(0);
  });

  it('returns ai parse stage when the AI request fails', async () => {
    testState.aiShouldFail = true;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(502);
    expect(body.stage).toBe('ai-parse');
  });

  it('returns ai parse stage when the AI response is malformed JSON', async () => {
    testState.aiContent = '{';

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(502);
    expect(body.stage).toBe('ai-parse');
  });

  it('returns schema validation stage when the parsed resume is invalid', async () => {
    testState.aiContent = JSON.stringify({ portfolio: { email: 'not-an-email' } });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(422);
    expect(body.stage).toBe('schema-validation');
  });

  it('returns schema validation stage when required parsed fields are blank', async () => {
    testState.aiContent = JSON.stringify(makeConvertedResumeData({ portfolio: { title: '   ' } }));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(422);
    expect(body.stage).toBe('schema-validation');
    expect(testState.uploadCalls).toHaveLength(0);
  });

  it('normalizes present dates before saving', async () => {
    testState.aiContent = JSON.stringify({
      ...makeConvertedResumeData(),
      workExperience: [
        {
          company: 'Company',
          role: 'Engineer',
          description: 'Built things',
          startDate: '2020-01',
          endDate: 'Present',
        },
      ],
    });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(
      (body.data as ReturnType<typeof makeConvertedResumeData>).workExperience[0],
    ).toMatchObject({
      startDate: '2020-01-01',
      endDate: null,
    });
  });

  it('passes normalized pdf MIME type to storage when file type is missing', async () => {
    const response = await callAction(formRequest(pdfFileWithoutMime()));

    expect(response.status).toBe(200);
    expect(testState.uploadCalls[0]).toEqual([
      expect.any(File),
      'user-id',
      'resumes',
      'resume.pdf',
      'application/pdf',
    ]);
  });

  it('returns storage stage when upload fails', async () => {
    testState.uploadResult = { success: false, publicUrl: undefined };

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(503);
    expect(body.stage).toBe('storage');
    expect(body.error).toMatch(/minio|r2|cloudflare/i);
  });

  it('returns database stage when saving fails', async () => {
    testState.saveShouldFail = true;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.stage).toBe('database');
    expect(testState.deleteCalls).toEqual([['file-id', 'user-id', 'resumes']]);
  });

  it('keeps database failure response when upload cleanup fails', async () => {
    testState.saveShouldFail = true;
    testState.deleteShouldFail = true;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.stage).toBe('database');
    expect(testState.deleteCalls).toHaveLength(1);
  });

  it('keeps database failure response when upload cleanup throws', async () => {
    testState.saveShouldFail = true;
    testState.deleteShouldThrow = true;

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.stage).toBe('database');
    expect(testState.deleteCalls).toHaveLength(1);
  });

  it('returns portfolio metadata when conversion succeeds', async () => {
    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body.stage).toBe('complete');
    expect(body.portfolioId).toBe('portfolio-id');
    expect(body.portfolioSlug).toBe('charles-ponti');
    expect(body.portfolioUrl).toBe('/p/charles-ponti');
    expect(body.fileUrl).toBe('http://localhost:9000/storage/resumes/resume.pdf');
  });
});
