import { describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  financeMonthlySummary: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class ValidationError extends Error {
    readonly code = 'VALIDATION_ERROR';
    readonly statusCode = 400;
  }

  return { ValidationError };
});

vi.mock('@hominem/db', () => ({
  FinanceQueryRepository: {
    monthlySummary: repositories.financeMonthlySummary,
  },
  ValidationError: errors.ValidationError,
}));

import { callPersonalMcpTool, listPersonalMcpTools } from './personal-tools';

const userId = '11111111-1111-4111-8111-111111111111';

describe('personal MCP tool registry', () => {
  it('lists only read-only personal capability tools', () => {
    const tools = listPersonalMcpTools();

    expect(tools.map((tool) => tool.name)).toEqual(['personal_finance_monthly_summary']);
    expect(tools.every((tool) => tool.readOnly)).toBe(true);
    expect(tools.flatMap((tool) => [...tool.scopes])).toEqual(['finance:read']);
  });

  it('rejects invalid tool input before calling a repository', async () => {
    repositories.financeMonthlySummary.mockClear();

    await expect(
      callPersonalMcpTool(userId, 'personal_finance_monthly_summary', { month: 'March' }),
    ).rejects.toThrow();
    expect(repositories.financeMonthlySummary).not.toHaveBeenCalled();
  });

  it('rejects unknown tool names with a stable validation error', async () => {
    await expect(callPersonalMcpTool(userId, 'raw_sql', {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});
