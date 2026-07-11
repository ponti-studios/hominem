import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  assertReadOnlyMcpCapability,
  defineCapability,
  parseCapabilityInput,
  parseCapabilityOutput,
} from './capability';

describe('capability foundation', () => {
  const capability = defineCapability({
    name: 'finance.monthly_summary',
    title: 'Monthly finance summary',
    description: 'Returns monthly finance metadata.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(25) }),
    outputSchema: z.object({ events: z.array(z.object({ title: z.string() })) }),
    readOnly: true,
    scopes: ['finance:read'],
    sensitivity: 'sensitive',
    resultCap: 50,
    transports: ['rpc', 'mcp'],
  });

  it('parses inputs and outputs from the registered runtime schemas', () => {
    expect(parseCapabilityInput(capability, {})).toEqual({ limit: 25 });
    expect(parseCapabilityOutput(capability, { events: [{ title: 'Dinner' }] })).toEqual({
      events: [{ title: 'Dinner' }],
    });
  });

  it('rejects invalid schema input before service invocation', () => {
    expect(() => parseCapabilityInput(capability, { limit: 100 })).toThrow();
  });

  it('enforces MCP read-only and result-cap rules', () => {
    expect(() => assertReadOnlyMcpCapability(capability)).not.toThrow();
    expect(() =>
      assertReadOnlyMcpCapability({ ...capability, name: 'finance.write', readOnly: false }),
    ).toThrow('MCP capability must be read-only: finance.write');
    expect(() =>
      assertReadOnlyMcpCapability({ ...capability, name: 'finance.dump', resultCap: 500 }),
    ).toThrow('MCP capability resultCap must be between 1 and 50: finance.dump');
  });
});
