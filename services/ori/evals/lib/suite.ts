import type { Assertion, TestCase, UnifiedConfig } from 'promptfoo';

import {
  fingerprint,
  fingerprintGrading,
  judgeModel,
  targetModel,
  type Golden,
  type PromptMessage,
} from './golden';
import type { McpFixtureProfile } from './mcp-fixtures';
import type { McpExpectation } from './mcp-scoring';

/**
 * regression: must stay green, any new failure blocks.
 * capability: tracks how good the model is, gated on pass-rate drop only.
 * holdout: release gate, run only after picking a prompt or model candidate.
 */
export type Tier = 'regression' | 'capability' | 'holdout';

export type Suite = {
  name: string;
  description: string;
  tier: Tier;
  config: UnifiedConfig;
  /** Dataset and prompt files, hashed into every run record. */
  datasetFiles: readonly URL[];
  promptFiles: readonly URL[];
};

export const JUDGE_MIN_SCORE = 0.7;

const path = (url: URL): string => url.pathname;

export const rubricAssertion = (rubric: string): Assertion => ({
  type: 'llm-rubric',
  value: `${rubric}\n\nReference output:\n{{expectedOutput}}`,
  threshold: JUDGE_MIN_SCORE,
});

export const fileAssertion = (
  file: string,
  config?: Record<string, unknown>,
  metric?: string,
): Assertion => ({
  type: 'javascript',
  value: `file://${new URL(`../assertions/${file}`, import.meta.url).pathname}`,
  ...(config ? { config } : {}),
  ...(metric ? { metric } : {}),
});

export const judgeProvider = {
  id: `openrouter:${judgeModel}`,
  config: { temperature: 0 },
};

type TextSuiteOptions = {
  name: string;
  description: string;
  tier: Tier;
  cases: readonly Golden[];
  datasetFiles: readonly URL[];
  promptFiles: readonly URL[];
  /** Chat messages for one case, already rendered. */
  messages: (golden: Golden) => PromptMessage[];
  /** JSON schema the model must follow. Also asserted on the output. */
  schema?: object;
  rubric?: string;
  /** Deterministic assertions, run before and instead of paying for a judge where possible. */
  assertions?: readonly Assertion[];
};

/** One prompt, one model, a dataset of goldens: the shape of every non-agent suite. */
export async function defineTextSuite(options: TextSuiteOptions): Promise<Suite> {
  const { schema, rubric, assertions = [] } = options;
  const tests: TestCase[] = options.cases.map((golden, index) => ({
    description: golden.name ?? `case ${index + 1}`,
    vars: {
      messages: options.messages(golden),
      expectedOutput: golden.expectedOutput,
      golden,
    },
    metadata: { category: golden.category ?? 'uncategorized', tier: options.tier },
    assert: [
      ...(schema ? [{ type: 'is-json' as const, value: schema }] : []),
      ...assertions,
      ...(rubric ? [rubricAssertion(rubric)] : []),
    ],
  }));
  return {
    name: options.name,
    description: options.description,
    tier: options.tier,
    datasetFiles: options.datasetFiles,
    promptFiles: options.promptFiles,
    config: {
      description: options.description,
      prompts: [`file://${path(new URL('./render-prompt.ts', import.meta.url))}`],
      providers: [
        {
          id: `openrouter:${targetModel}`,
          config: {
            temperature: 0,
            ...(schema
              ? {
                  response_format: {
                    type: 'json_schema',
                    json_schema: { name: options.name.replace(/\W+/g, '_'), strict: false, schema },
                  },
                }
              : {}),
          },
        },
      ],
      defaultTest: { options: { provider: judgeProvider } },
      tests,
      metadata: await suiteMetadata({ ...options, gradingSpec: { schema, rubric, assertions } }),
    },
  };
}

/** Code that decides pass/fail for every suite: change any of it and old baselines stop being comparable. */
const graderFiles = [
  'suite.ts',
  'golden.ts',
  'mcp-scoring.ts',
  'mcp-fixtures.ts',
  'mcp-tool-catalog.ts',
  'mcp-tool-catalog.generated.json',
  'schemas.ts',
  'time-block-compare.ts',
  '../assertions/concise.ts',
  '../assertions/time-block.ts',
  '../assertions/offer-shape.ts',
  '../assertions/mcp-grade.ts',
  '../providers/mcp-agent.ts',
].map((name) => new URL(name, import.meta.url));

export const suiteMetadata = async (options: {
  tier: Tier;
  datasetFiles: readonly URL[];
  promptFiles: readonly URL[];
  /** Rubrics, schemas, and expectations that define what counts as a pass. */
  gradingSpec: unknown;
}) => ({
  tier: options.tier,
  datasetHash: await fingerprint(options.datasetFiles),
  promptHash: await fingerprint(options.promptFiles),
  graderHash: await fingerprintGrading(graderFiles, options.gradingSpec),
});

export type McpCase = {
  /** Stable case id, shown in reports and used to key baselines. */
  id: string;
  category?: string;
  prompt: string;
  systemPrompt?: string;
  toolNames: readonly string[];
  fixture?: McpFixtureProfile;
  expected: McpExpectation;
  /** When set, a judge grades the final answer against this rubric after the trace passes. */
  rubric?: string;
};

type McpSuiteOptions = {
  name: string;
  description: string;
  tier: Tier;
  cases: readonly McpCase[];
  datasetFiles: readonly URL[];
  promptFiles: readonly URL[];
};

/** Agent suites: the model drives a fixture-backed tool loop; the trace is graded first. */
export async function defineMcpSuite(options: McpSuiteOptions): Promise<Suite> {
  const tests: TestCase[] = options.cases.map((scenario) => ({
    description: scenario.id,
    vars: {
      prompt: scenario.prompt,
      systemPrompt: scenario.systemPrompt ?? '',
      toolNames: scenario.toolNames.join(','),
      fixture: scenario.fixture ?? {},
      expected: scenario.expected,
      rubric: scenario.rubric ?? '',
    },
    metadata: { category: scenario.category ?? 'uncategorized', tier: options.tier },
    assert: [
      // One assertion on purpose: promptfoo runs separate assertions concurrently, so a
      // separate judge assertion would be paid for even when the trajectory already failed.
      fileAssertion('mcp-grade.ts', { minScore: JUDGE_MIN_SCORE }),
    ],
  }));
  return {
    name: options.name,
    description: options.description,
    tier: options.tier,
    datasetFiles: options.datasetFiles,
    promptFiles: options.promptFiles,
    config: {
      description: options.description,
      prompts: ['{{prompt}}'],
      providers: [
        {
          id: `file://${path(new URL('../providers/mcp-agent.ts', import.meta.url))}`,
          label: `mcp-agent:${targetModel}`,
          config: { model: targetModel },
        },
      ],
      tests,
      metadata: await suiteMetadata({
        ...options,
        gradingSpec: options.cases.map(({ id, expected, rubric }) => ({ id, expected, rubric })),
      }),
    },
  };
}
