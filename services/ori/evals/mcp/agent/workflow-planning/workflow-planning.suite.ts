import { loadJson } from '../../../lib/golden';
import type { McpFixtureProfile } from '../../../lib/mcp-fixtures';
import type { McpExpectation } from '../../../lib/mcp-scoring';
import { toolsByDomain, type McpToolDomain } from '../../../lib/mcp-tool-catalog';
import { defineMcpSuite } from '../../../lib/suite';

type Scenario = {
  id: string;
  category: string;
  prompt: string;
  toolDomains: McpToolDomain[];
  fixture?: McpFixtureProfile;
  expected: Omit<McpExpectation, 'requiredTools' | 'allowedTools'> & {
    tools?: string[];
    allowedTools?: string[];
  };
};

const scenariosUrl = new URL('./scenarios.json', import.meta.url);
const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(scenariosUrl);

export default await defineMcpSuite({
  name: 'mcp-workflow-planning',
  description: `Multi-step MCP workflows: lookups, IDs, confirmation boundaries (${benchmark.version})`,
  tier: 'regression',
  datasetFiles: [scenariosUrl],
  promptFiles: [new URL(import.meta.url)],
  cases: benchmark.scenarios.map((scenario) => ({
    id: scenario.id,
    category: scenario.category,
    prompt: scenario.prompt,
    systemPrompt:
      'You are testing a capability-first personal agent. Use the narrowest tools and preserve IDs and dates from results. Resolve names with people_lookup; if it returns multiple matches, ask the user which person they mean, and use person_timeline only when a timeline is requested. For explicit write requests, inspect lookup results, use their exact stable IDs, call the requested write tool once the target is unambiguous, and stop when confirmation is required. For create-if-missing requests, create after the list result confirms the exact name is absent. For spending during a specific trip, pass the exact trip dates from trip_history to finance_recent_transactions.',
    toolNames: scenario.toolDomains.flatMap((domain) =>
      toolsByDomain[domain].map((tool) => tool.function.name),
    ),
    fixture: scenario.fixture,
    expected: {
      ...scenario.expected,
      requiredTools: scenario.expected.tools,
      allowedTools: scenario.expected.allowedTools ?? scenario.expected.tools ?? [],
    },
  })),
});
