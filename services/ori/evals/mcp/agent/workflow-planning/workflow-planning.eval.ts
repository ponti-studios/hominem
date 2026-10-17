import { loadJson, targetModel } from '../../../lib/evaluator';
import { toolsForDomains, type McpToolDomain } from '../../../lib/mcp-harness';
import type { McpExpectation } from '../../../lib/mcp-scoring';
import { registerMcpSuite } from '../../../lib/mcp-suite';

type Scenario = {
  id: string;
  category: string;
  prompt: string;
  toolDomains: McpToolDomain[];
  fixture?: { ambiguousPerson?: boolean; collection?: 'japan' | 'existing' | 'missing' };
  expected: Omit<McpExpectation, 'requiredTools' | 'allowedTools'> & {
    tools?: string[];
    allowedTools?: string[];
  };
};

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('./scenarios.json', import.meta.url),
);

registerMcpSuite({
  name: `MCP workflow planning ${benchmark.version}`,
  model: targetModel,
  scenarios: benchmark.scenarios,
  buildCase: (scenario) => ({
    prompt: scenario.prompt,
    systemPrompt:
      'You are testing a capability-first personal agent. Use the narrowest tools and preserve IDs and dates from results. Resolve names with people_lookup; if it returns multiple matches, ask the user which person they mean, and use person_timeline only when a timeline is requested. For explicit write requests, inspect lookup results, use their exact stable IDs, call the requested write tool once the target is unambiguous, and stop when confirmation is required. For create-if-missing requests, create after the list result confirms the exact name is absent. For spending during a specific trip, pass the exact trip dates from trip_history to finance_recent_transactions.',
    tools: toolsForDomains(...scenario.toolDomains),
    fixture: scenario.fixture,
    expected: {
      ...scenario.expected,
      requiredTools: scenario.expected.tools,
      allowedTools: scenario.expected.allowedTools ?? scenario.expected.tools ?? [],
    },
  }),
});
