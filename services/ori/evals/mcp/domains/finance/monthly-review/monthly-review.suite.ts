import { buildFinanceReviewPromptText } from '../../../../../../api/src/mcp/prompts/finance-review-content';
import { loadJson } from '../../../../lib/golden';
import type { McpExpectation } from '../../../../lib/mcp-scoring';
import { toolsByDomain } from '../../../../lib/mcp-tool-catalog';
import { defineMcpSuite } from '../../../../lib/suite';

type Scenario = {
  id: string;
  category: string;
  month?: string;
  expected: Omit<McpExpectation, 'requiredTools' | 'allowedTools'> & {
    tools?: string[];
    allowedTools?: string[];
  };
  rubric: string;
};

const scenariosUrl = new URL('./scenarios.json', import.meta.url);
const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(scenariosUrl);
const financeTools = toolsByDomain.finance.map((tool) => tool.function.name);

export default await defineMcpSuite({
  name: 'mcp-finance-monthly-review',
  description: `Monthly finance review grounded in tool results (${benchmark.version})`,
  tier: 'capability',
  datasetFiles: [scenariosUrl],
  promptFiles: [new URL(import.meta.url)],
  cases: benchmark.scenarios.map((scenario) => ({
    id: scenario.id,
    category: scenario.category,
    prompt: buildFinanceReviewPromptText(scenario.month),
    toolNames: financeTools,
    expected: {
      ...scenario.expected,
      requiredTools: scenario.expected.tools,
      allowedTools: scenario.expected.allowedTools ?? scenario.expected.tools ?? [],
    },
    rubric: scenario.rubric,
  })),
});
