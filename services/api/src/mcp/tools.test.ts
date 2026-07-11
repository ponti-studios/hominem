import { describe, expect, it } from 'vitest';

import { callTool, listTools } from './tools';

const userId = '11111111-1111-4111-8111-111111111111';

describe('MCP tool registry', () => {
  it('starts with no registered tools', () => {
    const tools = listTools();
    expect(tools).toHaveLength(0);
  });

  it('rejects unknown tool names with a stable validation error', async () => {
    await expect(callTool(userId, 'raw_sql', {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});
