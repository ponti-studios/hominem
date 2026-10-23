import { loadJson, renderMessages, type Golden, type PromptMessage } from '../../lib/golden';
import { timeBlockSchema } from '../../lib/schemas';
import { defineTextSuite, fileAssertion } from '../../lib/suite';
import { timeBlockTitleRubric } from '../../lib/time-block-compare';
import { describeUpcomingDays } from '../../lib/upcoming-days';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./regression-expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'time-block-regression',
  description: 'Natural-language scheduling requests become correct time blocks (regression set)',
  tier: 'regression',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) => {
    const metadata = golden.additionalMetadata ?? {};
    return renderMessages(prompt, {
      referenceDateTime: String(metadata.referenceDateTime),
      timezone: String(metadata.timezone),
      upcomingDays:
        describeUpcomingDays(String(metadata.referenceDateTime), String(metadata.timezone)) ?? '',
      calendarContext: String(metadata.calendarContext),
      conversationContext: String(metadata.conversationContext),
      input: golden.input,
    });
  },
  schema: timeBlockSchema,
  assertions: [fileAssertion('time-block.ts', undefined, 'fields')],
  rubric: timeBlockTitleRubric,
});
