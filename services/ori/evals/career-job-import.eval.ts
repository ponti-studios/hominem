import { assertJobImportOutput } from './lib/career-compare';
import {
  loadJson,
  loadText,
  registerJsonSuite,
  renderMessages,
  type Golden,
  type PromptMessage,
} from './lib/evaluator';
import { jobImportSchema } from './lib/schemas';

const suiteDir = new URL('../data/career-job-import/', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(new URL('prompt.json', suiteDir));
const postingText = await loadText(new URL('fixtures/whatnot-ashby-posting.html', suiteDir));
const coreExcerptText = await loadText(new URL('fixtures/whatnot-core-excerpt.html', suiteDir));

type CareerCase = Omit<Golden, 'additionalMetadata'> & {
  additionalMetadata?: Record<string, unknown> & {
    postingFixture?: 'whatnot-ashby-posting.html' | 'whatnot-core-excerpt.html';
  };
};

const careerCases = await loadJson<CareerCase[]>(new URL('goldens.json', suiteDir));

registerJsonSuite({
  name: 'career job import',
  cases: careerCases,
  buildInput: (golden) => {
    const source =
      golden.additionalMetadata?.postingFixture === 'whatnot-core-excerpt.html'
        ? coreExcerptText
        : postingText;
    return renderMessages(prompt, { postingText: source });
  },
  outputSchema: jobImportSchema,
  assertOutput: (output, golden) => {
    assertJobImportOutput(output, golden.expectedOutput);
  },
  rubric: [
    'Require the correct Whatnot company and AI Tooling Engineer role.',
    'Require unavailable fields to be empty strings or arrays, not invented details.',
    'Typography, punctuation, and whitespace variants in copied body text are already checked separately; focus field-level accuracy and grounding.',
  ].join('\n'),
});
