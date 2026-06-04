// @vitest-environment node

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCareerTestDb } from '~/test/db/career';
import { makeConvertedResumeData } from '~/test/factories/resume';

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  createStorageService: vi.fn(),
  deleteFile: vi.fn(),
  extractPdfText: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  isRateLimitAllowed: vi.fn(),
  logError: vi.fn(),
  resolveUploadMimeType: vi.fn(),
  saveResumeToDatabase: vi.fn(),
  storeFile: vi.fn(),
  validateFile: vi.fn(),
}));

vi.mock('../lib/auth.server', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: mocks.logError,
  },
}));

vi.mock('@hominem/storage', () => ({
  createStorageService: mocks.createStorageService,
  resolveUploadMimeType: mocks.resolveUploadMimeType,
  validateFile: mocks.validateFile,
}));

vi.mock('../lib/services/resume-conversion.service', () => ({
  saveResumeToDatabase: mocks.saveResumeToDatabase,
}));

vi.mock('../lib/services/pdf-text.server', () => ({
  extractPdfText: mocks.extractPdfText,
}));

vi.mock('../lib/rate-limit', () => ({
  resumeConvertRateLimit: {
    maxRequests: 3,
    isAllowed: mocks.isRateLimitAllowed,
  },
  getRateLimitHeaders: mocks.getRateLimitHeaders,
}));

vi.mock('@hominem/services/ai-model', () => ({
  createChatCompletion: mocks.createCompletion,
  getChatCompletionText: vi.fn((result: { choices?: Array<{ message?: { content?: string } }> }) => result.choices?.[0]?.message?.content ?? ''),
}));

let action: typeof import('./api.resume.convert').action;
const testDb = createCareerTestDb();

beforeAll(async () => {
  mocks.createStorageService.mockReturnValue({
    deleteFile: mocks.deleteFile,
    storeFile: mocks.storeFile,
  });
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
  const formData = new FormData();
  if (file) formData.set('pdf', file);
  if (options?.replaceExisting) formData.set('replaceExisting', 'true');

  return new Request('http://localhost/api/resume/convert', {
    method: 'POST',
    body: formData,
  });
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
  mocks.getAuthenticatedUser.mockResolvedValue({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  return portfolio;
}

describe('resume convert action', () => {
  beforeEach(() => {
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
    });
    mocks.isRateLimitAllowed.mockReturnValue({
      allowed: true,
      remaining: 2,
      resetTime: 1_893_456_000_000,
    });
    mocks.getRateLimitHeaders.mockImplementation(
      (result: { remaining: number; resetTime: number }) => ({
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
      }),
    );
    mocks.validateFile.mockReturnValue({ valid: true });
    mocks.resolveUploadMimeType.mockImplementation((file: File) => {
      const type = file.type === 'application/octet-stream' ? '' : file.type;
      return type || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    });
    mocks.extractPdfText.mockResolvedValue('resume text');
    mocks.createCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeConvertedResumeData()) } }],
    });
    mocks.storeFile.mockResolvedValue({
      id: 'file-id',
      url: 'http://localhost:9000/storage/resumes/resume.pdf',
    });
    mocks.deleteFile.mockResolvedValue(true);
    mocks.saveResumeToDatabase.mockResolvedValue({
      portfolio_id: 'portfolio-id',
      portfolioSlug: 'charles-ponti',
    });
  });

  it('returns auth stage when the user is not authenticated', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

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
    mocks.isRateLimitAllowed.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: 1_893_456_000_000,
    });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(body.stage).toBe('rate-limit');
    expect(body.rateLimit).toMatchObject({ limit: 3, remaining: 0 });
    expect(mocks.extractPdfText).not.toHaveBeenCalled();
    expect(mocks.createCompletion).not.toHaveBeenCalled();
    expect(mocks.storeFile).not.toHaveBeenCalled();
  });

  it('returns file validation stage when no file is attached', async () => {
    const response = await callAction(formRequest());
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('file-validation');
  });

  it('returns file validation stage when file validation fails', async () => {
    mocks.validateFile.mockReturnValue({ valid: false, error: 'Invalid PDF' });

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
    expect(mocks.extractPdfText).not.toHaveBeenCalled();
    expect(mocks.createCompletion).not.toHaveBeenCalled();
    expect(mocks.storeFile).not.toHaveBeenCalled();
  });

  it('continues conversion when replacing an existing portfolio is confirmed', async () => {
    await createExistingPortfolio();

    const response = await callAction(formRequest(pdfFile(), { replaceExisting: true }));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body.stage).toBe('complete');
    expect(mocks.extractPdfText).toHaveBeenCalledTimes(1);
  });

  it('returns pdf extraction stage when text extraction fails', async () => {
    mocks.extractPdfText.mockRejectedValue(new Error('pdf failed'));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('pdf-extraction');
  });

  it('returns pdf extraction stage when extracted text is empty', async () => {
    mocks.extractPdfText.mockResolvedValue('   ');

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('pdf-extraction');
  });

  it('returns pdf extraction stage when extracted text is too large', async () => {
    mocks.extractPdfText.mockResolvedValue('x'.repeat(80_001));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(400);
    expect(body.stage).toBe('pdf-extraction');
    expect(mocks.createCompletion).not.toHaveBeenCalled();
  });

  it('returns ai parse stage when the AI request fails', async () => {
    mocks.createCompletion.mockRejectedValue(new Error('ai failed'));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(502);
    expect(body.stage).toBe('ai-parse');
  });

  it('returns ai parse stage when the AI response is malformed JSON', async () => {
    mocks.createCompletion.mockResolvedValue({ choices: [{ message: { content: '{' } }] });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(502);
    expect(body.stage).toBe('ai-parse');
  });

  it('returns schema validation stage when the parsed resume is invalid', async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ portfolio: { email: 'not-an-email' } }) } }],
    });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(422);
    expect(body.stage).toBe('schema-validation');
  });

  it('returns schema validation stage when required parsed fields are blank', async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(makeConvertedResumeData({ portfolio: { title: '   ' } })),
          },
        },
      ],
    });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(422);
    expect(body.stage).toBe('schema-validation');
    expect(mocks.storeFile).not.toHaveBeenCalled();
  });

  it('normalizes present dates before saving', async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...makeConvertedResumeData(),
              workExperience: [
                {
                  company: 'Company',
                  role: 'Engineer',
                  description: 'Built things',
                  start_date: '2020-01',
                  end_date: 'Present',
                },
              ],
            }),
          },
        },
      ],
    });

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(
      (body.data as ReturnType<typeof makeConvertedResumeData>).workExperience[0],
    ).toMatchObject({
      start_date: '2020-01-01',
      end_date: null,
    });
  });

  it('passes normalized pdf MIME type to storage when file type is missing', async () => {
    const response = await callAction(formRequest(pdfFileWithoutMime()));

    expect(response.status).toBe(200);
    expect(mocks.storeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/pdf',
      'user-id',
      { originalName: 'resume.pdf' },
    );
  });

  it('returns storage stage when upload fails', async () => {
    mocks.storeFile.mockRejectedValue(new Error('storage failed'));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(503);
    expect(body.stage).toBe('storage');
    expect(body.error).toMatch(/minio|r2|cloudflare/i);
  });

  it('returns database stage when saving fails', async () => {
    mocks.saveResumeToDatabase.mockRejectedValue(new Error('db failed'));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.stage).toBe('database');
    expect(mocks.deleteFile).toHaveBeenCalledWith('file-id', 'user-id');
  });

  it('keeps database failure response when upload cleanup fails', async () => {
    mocks.saveResumeToDatabase.mockRejectedValue(new Error('db failed'));
    mocks.deleteFile.mockResolvedValue(false);

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.stage).toBe('database');
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('keeps database failure response when upload cleanup throws', async () => {
    mocks.saveResumeToDatabase.mockRejectedValue(new Error('db failed'));
    mocks.deleteFile.mockRejectedValue(new Error('cleanup threw'));

    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.stage).toBe('database');
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('returns portfolio metadata when conversion succeeds', async () => {
    const response = await callAction(formRequest(pdfFile()));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body.stage).toBe('complete');
    expect(body.portfolio_id).toBe('portfolio-id');
    expect(body.portfolioSlug).toBe('charles-ponti');
    expect(body.portfolioUrl).toBe('/p/charles-ponti');
    expect(body.fileUrl).toBe('http://localhost:9000/storage/resumes/resume.pdf');
  });
});
