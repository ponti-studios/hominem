import {
  currentUtcDateLabel,
  loadJson,
  renderMessages,
  type PromptMessage,
} from '../../../lib/golden';
import type { McpFixtureProfile } from '../../../lib/mcp-fixtures';
import type { McpExpectation } from '../../../lib/mcp-scoring';
import { allTools, type McpToolDomain } from '../../../lib/mcp-tool-catalog';
import { defineMcpSuite } from '../../../lib/suite';

// Realistic things a user types. Every case sees the full MCP catalog, the way a real session
// does, so these test discovery across all tools instead of a curated subset. toolDomains is
// kept for the record only and does not narrow the tool list.
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

const scenariosUrl = new URL('./requests.json', import.meta.url);
const promptUrl = new URL('../../../chat/assistant/system-prompt.json', import.meta.url);
const systemPrompt =
  renderMessages(await loadJson<PromptMessage[]>(promptUrl), {
    user_message: '',
    current_date: currentUtcDateLabel(),
  })[0]?.content ?? '';
const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(scenariosUrl);

export default await defineMcpSuite({
  name: 'mcp-user-requests',
  description: `Realistic user requests across all MCP domains: lookups, writes, chains, confirmation boundaries (${benchmark.version})`,
  tier: 'capability',
  // Real MCP execution against the local API. Needs HOMINEM_EVAL_MCP_TOKEN and OPENROUTER_API_KEY.
  provider: 'live',
  datasetFiles: [scenariosUrl],
  promptFiles: [promptUrl],
  cases: benchmark.scenarios.map((scenario) => ({
    id: scenario.id,
    category: scenario.category,
    prompt: scenario.prompt,
    systemPrompt,
    toolNames: allTools.map((tool) => tool.function.name),
    fixture: scenario.fixture,
    expected: {
      ...scenario.expected,
      requiredTools: scenario.expected.tools,
      allowedTools: scenario.expected.allowedTools ?? scenario.expected.tools ?? [],
    },
  })),
});
