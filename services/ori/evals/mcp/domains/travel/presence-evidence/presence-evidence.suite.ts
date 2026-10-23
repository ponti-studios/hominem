import { loadJson } from '../../../../lib/golden';
import { defineMcpSuite } from '../../../../lib/suite';

type Scenario = {
  name: string;
  category: string;
  promptVersion: string;
  input: string;
  expectedOutput: string;
  expectedTools: Array<{ name: string }>;
  expectedOutputIncludes: string[];
};

const casesUrl = new URL('./expected-cases.json', import.meta.url);
const dataUrl = new URL('./country-presence-tool-response.json', import.meta.url);
const scenarios = await loadJson<Scenario[]>(casesUrl);
const travelPresenceData = await loadJson<unknown>(dataUrl);

export default await defineMcpSuite({
  name: 'mcp-travel-presence-evidence',
  description: 'Travel presence answers separate stops, layovers, visits and residence',
  tier: 'capability',
  datasetFiles: [casesUrl, dataUrl],
  promptFiles: [new URL(import.meta.url)],
  cases: scenarios.map((scenario) => ({
    id: scenario.name,
    category: scenario.category,
    prompt: scenario.input,
    systemPrompt:
      'Use travel_countries for country and place-presence questions. Treat stop, layover, visit, and residence as distinct evidence; one place can have multiple types. When asked about a layover, explicitly distinguish the airport layover from a destination stop.',
    toolNames: ['travel_countries'],
    fixture: { responses: { travel_countries: { output: travelPresenceData } } },
    expected: {
      requiredTools: scenario.expectedTools.map(({ name }) => name),
      allowedTools: scenario.expectedTools.map(({ name }) => name),
      outputIncludes: scenario.expectedOutputIncludes,
    },
    rubric: scenario.expectedOutput,
  })),
});
