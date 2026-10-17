import { loadJson, judgeModel, targetModel } from '../../../../lib/evaluator';
import { registerMcpSuite } from '../../../../lib/mcp-suite';

type Scenario = {
  name: string;
  category: string;
  promptVersion: string;
  input: string;
  expectedOutput: string;
  expectedTools: Array<{ name: string }>;
  expectedOutputIncludes: string[];
};

const scenarios = await loadJson<Scenario[]>(new URL('./expected-cases.json', import.meta.url));
const travelPresenceData = await loadJson<unknown>(
  new URL('./country-presence-tool-response.json', import.meta.url),
);

registerMcpSuite({
  name: 'MCP travel presence evidence',
  model: targetModel,
  scenarios,
  buildCase: (scenario) => ({
    prompt: scenario.input,
    systemPrompt:
      'Use travel_countries for country and place-presence questions. Treat stop, layover, visit, and residence as distinct evidence; one place can have multiple types. When asked about a layover, explicitly distinguish the airport layover from a destination stop.',
    tools: ['travel_countries'],
    fixture: { responses: { travel_countries: { output: travelPresenceData } } },
    expected: {
      requiredTools: scenario.expectedTools.map(({ name }) => name),
      allowedTools: scenario.expectedTools.map(({ name }) => name),
      outputIncludes: scenario.expectedOutputIncludes,
    },
  }),
  judge: {
    model: judgeModel,
    minScore: 0.7,
    criteria: (scenario, result) =>
      `${scenario.expectedOutput}\n\nAuthoritative tool results (use only these facts):\n${JSON.stringify(result.trace.calls?.map(({ tool, output }) => ({ tool, output })) ?? [])}`,
  },
});
