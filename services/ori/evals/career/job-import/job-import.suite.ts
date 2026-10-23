import {
  loadJson,
  loadText,
  renderMessages,
  type Golden,
  type PromptMessage,
} from '../../lib/golden';
import { jobImportSchema } from '../../lib/schemas';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const postingUrl = new URL('./fixtures/whatnot-ai-tooling-engineer-posting.html', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);
const postingText = await loadText(postingUrl);

export default await defineTextSuite({
  name: 'career-job-import',
  description: 'A job posting imports into structured career data without summarizing',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl, postingUrl],
  promptFiles: [promptUrl],
  messages: () => renderMessages(prompt, { postingText }),
  schema: jobImportSchema,
  rubric: [
    'Require the correct Whatnot company and AI Tooling Engineer role.',
    'Require fullText and jobDescription to retain the complete job description in source order, not a summary.',
    'Require fields to be grounded only in the supplied posting and leave unavailable fields empty.',
  ].join('\n'),
});
