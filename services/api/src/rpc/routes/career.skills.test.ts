import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deriveAndReplaceCareerSkills: vi.fn(),
  searchCareerSkills: vi.fn(),
}));

vi.mock('../../application/career-skills.service', () => mocks);

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

import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { careerSkillsRoutes } from './career.skills';

const app = new Hono<AppContext>().route('/skills', careerSkillsRoutes).onError(apiErrorHandler);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('career skill suggestions', () => {
  it('returns stored and curated suggestions for a query', async () => {
    mocks.searchCareerSkills.mockResolvedValue(['TypeScript', 'JavaScript']);

    const response = await app.request('/skills/search?q=type');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      suggestions: ['TypeScript', 'JavaScript'],
    });
    expect(mocks.searchCareerSkills).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'type',
    );
  });

  it('derives skills and reports the stored set', async () => {
    mocks.deriveAndReplaceCareerSkills.mockResolvedValue([{ name: 'TypeScript', level: 90 }]);

    const response = await app.request('/skills/derive', { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      skills: [{ name: 'TypeScript', level: 90 }],
    });
  });
});
