import {
  currentUtcDateLabel,
  loadJson,
  renderMessages,
  type PromptMessage,
} from '../../../lib/golden';
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
// The chat assistant's own prompt, so these workflows test what ships instead of a bespoke instruction.
const promptUrl = new URL('../../../chat/assistant/system-prompt.json', import.meta.url);
const systemPrompt =
  renderMessages(await loadJson<PromptMessage[]>(promptUrl), {
    user_message: '',
    current_date: currentUtcDateLabel(),
  })[0]?.content ?? '';
const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(scenariosUrl);

export default await defineMcpSuite({
  name: 'mcp-workflow-planning',
  description: `Multi-step MCP workflows: lookups, IDs, confirmation boundaries (${benchmark.version})`,
  tier: 'regression',
  datasetFiles: [scenariosUrl],
  promptFiles: [promptUrl],
  cases: benchmark.scenarios.map((scenario) => ({
    id: scenario.id,
    category: scenario.category,
    prompt: scenario.prompt,
    systemPrompt,
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
