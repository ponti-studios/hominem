import { File as NodeFile } from 'node:buffer';

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const validResumeData = {
  portfolio: {
    slug: 'charles-ponti',
    title: 'Portfolio',
    name: 'Charles Ponti',
    initials: 'CP',
    jobTitle: 'Engineer',
    bio: 'Bio',
    tagline: 'Tagline',
    currentLocation: 'Los Angeles',
    locationTagline: null,
    email: 'charles@example.com',
    phone: null,
    availabilityStatus: true,
    availabilityMessage: null,
    isPublic: true,
    isActive: true,
  },
  socialLinks: null,
  workExperience: [],
  skills: [],
  projects: [],
  stats: [],
};

const testState = vi.hoisted(() => ({
  authUser: {
    id: 'user-id',
    email: 'user@example.com',
    name: 'Test User',
  } as { id: string; email: string; name: string } | null,
  validationResult: { valid: true } as { valid: boolean; error?: string },
  pdfText: 'resume text',
  pdfShouldFail: false,
  aiContent: '',
  aiShouldFail: false,
  uploadResult: {
    success: true,
    publicUrl: 'http://localhost:9000/storage/resumes/resume.pdf',
  } as { success: boolean; publicUrl?: string },
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
  uploadFile: vi.fn(async () => testState.uploadResult),
}));

vi.mock('../lib/services/resume-conversion.service', () => ({
  saveResumeToDatabase: vi.fn(async () => {
    if (testState.saveShouldFail) throw new Error('db failed');
    return testState.saveResult;
  }),
}));

vi.mock('../lib/services/pdf-text.server', () => ({
  extractPdfText: vi.fn(async () => {
    if (testState.pdfShouldFail) throw new Error('pdf failed');
    return testState.pdfText;
  }),
}));

vi.mock('@hominem/services/ai-model', () => ({
  getSharedAiModelConfig: vi.fn(() => ({ modelId: 'test-model' })),
  getSharedOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => {
          if (testState.aiShouldFail) throw new Error('ai failed');
          return { choices: [{ message: { content: testState.aiContent } }] };
        }),
      },
    },
  })),
}));

let action: typeof import('./api.resume.convert').action;

beforeAll(async () => {
  ({ action } = await import('./api.resume.convert'));
});

function pdfFile(): File {
  return new NodeFile(['pdf'], 'resume.pdf', { type: 'application/pdf' }) as unknown as File;
}

function formRequest(file?: File): Request {
  const formData = new FormData();
  if (file) formData.append('pdf', file);

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

describe('resume convert action', () => {
  beforeEach(() => {
    testState.authUser = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
    };
    testState.validationResult = { valid: true };
    testState.pdfText = 'resume text';
    testState.pdfShouldFail = false;
    testState.aiContent = JSON.stringify(validResumeData);
    testState.aiShouldFail = false;
    testState.uploadResult = {
      success: true,
      publicUrl: 'http://localhost:9000/storage/resumes/resume.pdf',
    };
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
