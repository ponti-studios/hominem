import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AppContext, RpcUser } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';

const repositories = vi.hoisted(() => ({
  calendarSearch: vi.fn(),
  calendarUpcoming: vi.fn(),
  financeMonthlySummary: vi.fn(),
  getPersonalDataHealth: vi.fn(),
}));

const errorClasses = vi.hoisted(() => {
  class MockServiceError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;

    constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
    }
  }

  class MockUnauthorizedError extends MockServiceError {
    constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
      super(message, 'UNAUTHORIZED', 401, details);
    }
  }

  return { MockServiceError, MockUnauthorizedError };
});

vi.mock('@hominem/db', () => ({
  CalendarQueryRepository: {
    search: repositories.calendarSearch,
    upcoming: repositories.calendarUpcoming,
  },
  FinanceQueryRepository: {
    monthlySummary: repositories.financeMonthlySummary,
  },
  ImportHealthRepository: {
    getPersonalDataHealth: repositories.getPersonalDataHealth,
  },
  ConflictError: errorClasses.MockServiceError,
  ForbiddenError: errorClasses.MockServiceError,
  InternalError: errorClasses.MockServiceError,
  NotFoundError: errorClasses.MockServiceError,
  ServiceError: errorClasses.MockServiceError,
  UnauthorizedError: errorClasses.MockUnauthorizedError,
  UnavailableError: errorClasses.MockServiceError,
  ValidationError: errorClasses.MockServiceError,
  isServiceError: (value: unknown) =>
    value instanceof errorClasses.MockServiceError ||
    (typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      'statusCode' in value &&
      'message' in value),
}));

import { personalRoutes } from './personal';

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'personal@example.com',
  name: 'Personal Test User',
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp(authenticated: boolean) {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware);

  if (authenticated) {
    app.use('*', async (c, next) => {
      c.set('user', testUser);
      c.set('userId', testUser.id);
      await next();
    });
  }

  return app.route('/api/personal', personalRoutes);
}

describe('personal routes', () => {
  it('requires authentication', async () => {
    const response = await createApp(false).request('/api/personal/data-health');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('validates finance month queries before calling repositories', async () => {
    repositories.financeMonthlySummary.mockClear();

    const response = await createApp(true).request('/api/personal/finance/monthly-summary?month=March');

    expect(response.status).toBe(400);
    expect(repositories.financeMonthlySummary).not.toHaveBeenCalled();
  });

  it('returns read-only personal data health in a data envelope', async () => {
    repositories.getPersonalDataHealth.mockResolvedValueOnce({
      databaseAccessible: true,
      importSourceCount: 1,
      importRunCount: 2,
      latestImportCompletedAt: '2026-07-10T10:00:00.000Z',
      artifactCount: 3,
      rawRecordCount: 4,
      canonicalCounts: {
        calendarOccurrences: 5,
        financeTransactions: 6,
        notes: 7,
        chats: 8,
      },
      sources: [],
      reconciliations: [],
      warnings: [],
    });

    const response = await createApp(true).request('/api/personal/data-health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        databaseAccessible: true,
        canonicalCounts: {
          calendarOccurrences: 5,
          financeTransactions: 6,
        },
      },
    });
    expect(repositories.getPersonalDataHealth).toHaveBeenCalledWith(testUser.id);
  });
});
