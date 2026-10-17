import { buildFinanceReviewPromptText } from '../../../../../../api/src/mcp/prompts/finance-review-content';
import { judgeModel, loadJson, targetModel } from '../../../../lib/evaluator';
import { toolsForDomains } from '../../../../lib/mcp-harness';
import type { McpExpectation } from '../../../../lib/mcp-scoring';
import { registerMcpSuite } from '../../../../lib/mcp-suite';

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

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('./scenarios.json', import.meta.url),
);
const financeTools = toolsForDomains('finance');

registerMcpSuite({
  name: `MCP finance monthly review ${benchmark.version}`,
  model: targetModel,
  scenarios: benchmark.scenarios,
  buildCase: (scenario) => ({
    prompt: buildFinanceReviewPromptText(scenario.month),
    tools: financeTools,
    expected: {
      ...scenario.expected,
      requiredTools: scenario.expected.tools,
      allowedTools: scenario.expected.allowedTools ?? scenario.expected.tools ?? [],
    },
  }),
  judge: {
    model: judgeModel,
    minScore: 0.7,
    criteria: (scenario, result) =>
      `${scenario.rubric}\n\nAuthoritative tool results for this run (the candidate must use only these values):\n${JSON.stringify(result.trace.calls?.map(({ tool, input, output }) => ({ tool, input, output })) ?? [])}`,
  },
});
