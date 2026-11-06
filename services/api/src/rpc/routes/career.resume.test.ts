import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  convertResume: vi.fn(),
  startResumeAnalysis: vi.fn(),
  getResumeJob: vi.fn(),
  customizeResume: vi.fn(),
  applyResumeImport: vi.fn(),
}));

vi.mock('../../application/career-resume.service', async () => {
  const actual = await vi.importActual<typeof import('../../application/career-resume.service')>(
    '../../application/career-resume.service',
  );
  return { ...actual, ...mocks };
});

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    context: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    context.set('auth', {
      userId: '11111111-1111-4111-8111-111111111111',
      user: { id: '11111111-1111-4111-8111-111111111111' },
    });
    await next();
  },
}));

import { CareerResumeError } from '../../application/career-resume.service';
import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { careerResumeRoutes } from './career.resume';

const app = new Hono<AppContext>().route('/resume', careerResumeRoutes).onError(apiErrorHandler);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('career resume routes', () => {
  it('maps a readable-pdf failure into the upload state machine shape', async () => {
    mocks.convertResume.mockRejectedValue(
      new CareerResumeError(
        'This PDF did not contain readable text.',
        400,
        'pdf-extraction',
        true,
        'u',
      ),
    );

    const form = new FormData();
    form.set('pdf', new File([new Uint8Array([1])], 'resume.pdf', { type: 'application/pdf' }));
    const response = await app.request('/resume/convert', { method: 'POST', body: form });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      stage: 'pdf-extraction',
      retryable: true,
      fileUrl: 'u',
    });
  });

  it('returns the stored job id when analysis starts', async () => {
    mocks.startResumeAnalysis.mockResolvedValue({ jobId: 'job-1', fileUrl: 'https://file' });

    const form = new FormData();
    form.set('pdf', new File([new Uint8Array([1])], 'resume.pdf', { type: 'application/pdf' }));
    const response = await app.request('/resume/analyze', { method: 'POST', body: form });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ jobId: 'job-1', fileUrl: 'https://file' });
  });

  it('forwards the customize payload and returns the generated resume', async () => {
    mocks.customizeResume.mockResolvedValue({
      customizedResume: '# Resume',
      jobAnalysis: null,
      metadata: { format: 'professional' },
    });

    const response = await app.request('/resume/customize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ job_posting: 'x'.repeat(120) }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ customizedResume: '# Resume' });
    expect(mocks.customizeResume).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ job_posting: 'x'.repeat(120) }),
    );
  });

  it('applies only the selected import keys', async () => {
    mocks.applyResumeImport.mockResolvedValue({ profileId: 'profile-1' });

    const response = await app.request('/resume/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1', scalarKeys: ['basics.headline'], listKeys: [] }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, profileId: 'profile-1' });
    expect(mocks.applyResumeImport).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'job-1',
      { scalarKeys: ['basics.headline'], listKeys: [] },
    );
  });

  it('rejects an import with no selection keys', async () => {
    const response = await app.request('/resume/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.applyResumeImport).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'job-1',
      { scalarKeys: [], listKeys: [] },
    );
  });
});
