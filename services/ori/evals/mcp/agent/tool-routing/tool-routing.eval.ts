import { pilotCases } from 'ori/eval';

import { loadJson, targetModel, type Golden } from '../../../lib/evaluator';
import { toolsForDomains, type McpToolDomain } from '../../../lib/mcp-harness';
import { registerMcpSuite } from '../../../lib/mcp-suite';

type McpGolden = Golden & {
  expectedTools: Array<{ name: string }>;
  expectedOutputIncludes?: string[];
  toolDomains: McpToolDomain[];
};

const cases = await loadJson<McpGolden[]>(new URL('./expected-cases.json', import.meta.url));

registerMcpSuite({
  name: 'MCP agent tool routing',
  model: targetModel,
  scenarios: pilotCases(cases),
  buildCase: (golden) => {
    const expectedTools = golden.expectedTools.map(({ name }) => name);
    return {
      prompt: golden.input,
      systemPrompt:
        'Use the available Hominem tools when they are needed. Treat broad history questions as requests for all available records; omit date bounds unless the user asks for a date range. Complete the request concisely.',
      tools: toolsForDomains(...golden.toolDomains),
      expected: {
        requiredTools: expectedTools,
        allowedTools: expectedTools,
        outputIncludes: golden.expectedOutputIncludes,
      },
    };
  },
});
