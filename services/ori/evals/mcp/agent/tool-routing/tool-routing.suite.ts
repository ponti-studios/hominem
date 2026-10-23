import { loadJson, type Golden } from '../../../lib/golden';
import { toolsByDomain, type McpToolDomain } from '../../../lib/mcp-tool-catalog';
import { defineMcpSuite } from '../../../lib/suite';

type RoutingGolden = Golden & {
  expectedTools: Array<{ name: string }>;
  expectedOutputIncludes?: string[];
  toolDomains: McpToolDomain[];
};

const casesUrl = new URL('./expected-cases.json', import.meta.url);
const cases = await loadJson<RoutingGolden[]>(casesUrl);

export default await defineMcpSuite({
  name: 'mcp-tool-routing',
  description: 'The agent picks the narrowest correct Hominem MCP tools',
  tier: 'regression',
  datasetFiles: [casesUrl],
  promptFiles: [new URL(import.meta.url)],
  cases: cases.map((golden, index) => {
    const expectedTools = golden.expectedTools.map(({ name }) => name);
    return {
      id: golden.name ?? `routing-${index + 1}`,
      category: golden.category,
      prompt: golden.input,
      systemPrompt:
        'Use the available Hominem tools when they are needed. Treat broad history questions as requests for all available records; omit date bounds unless the user asks for a date range. Complete the request concisely.',
      toolNames: golden.toolDomains.flatMap((domain) =>
        toolsByDomain[domain].map((tool) => tool.function.name),
      ),
      expected: {
        requiredTools: expectedTools,
        allowedTools: expectedTools,
        outputIncludes: golden.expectedOutputIncludes,
      },
    };
  }),
});
