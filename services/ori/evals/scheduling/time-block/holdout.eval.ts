import {
  loadJson,
  registerJsonSuite,
  renderMessages,
  type Golden,
  type PromptMessage,
} from '../../lib/evaluator';
import { timeBlockSchema } from '../../lib/schemas';
import { assertTimeBlockFields, timeBlockTitleRubric } from '../../lib/time-block-compare';
import { describeUpcomingDays } from '../../lib/upcoming-days';

const suiteDir = new URL('./', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(new URL('system-prompt.json', suiteDir));
const cases = await loadJson<Golden[]>(new URL('holdout-expected-cases.json', suiteDir));

registerJsonSuite({
  name: 'time block holdout',
  cases,
  buildInput: (golden) => {
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
  outputSchema: timeBlockSchema,
  assertOutput: assertTimeBlockFields,
  rubric: timeBlockTitleRubric,
});
