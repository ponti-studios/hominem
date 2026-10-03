import {
  createStructuredChatCompletion,
  getReasoningConfig,
  normalizeOpenRouterError,
  StructuredOutputError,
  TIME_BLOCK_EXTRACTION_MODEL,
  type AIUsageMetrics,
  type OpenRouterClientOptions,
} from '@hominem/ai';
import { z } from 'zod';

const TimeBlockIntent = z.enum([
  'add_task',
  'add_event',
  'add_recurring_event',
  'edit_event',
  'cancel_event',
  'search',
  'schedule_gap_fill',
]);

const RecurrenceRule = z.preprocess(
  (value) => (typeof value === 'string' ? value.replace(/^RRULE:/i, '') : value),
  z.string().trim().max(500).nullable(),
);

const RawTimeBlockSchema = z.object({
  primary_intent: TimeBlockIntent,
  title: z.string().trim().max(200).nullable(),
  target_title: z.string().trim().max(200).nullable(),
  participants: z.array(z.string().trim().min(1).max(120)).max(20).nullable(),
  location: z.string().trim().max(500).nullable(),
  duration: z.number().int().positive().max(1440).nullable(),
  start_time: z.iso.datetime({ offset: true }).nullable(),
  end_time: z.iso.datetime({ offset: true }).nullable(),
  scheduling_window_start: z.iso.datetime({ offset: true }).nullable(),
  scheduling_window_end: z.iso.datetime({ offset: true }).nullable(),
  deadline_fixed: z.iso.date().nullable(),
  recurrence_rule: RecurrenceRule,
});

type TimeBlock = z.infer<typeof RawTimeBlockSchema>;

type TimeBlockExtractionInput = OpenRouterClientOptions & {
  transcript: string;
  referenceDate: string;
  timezone?: string;
  conversationContext?: string;
  calendarContext?: string;
  model?: string;
};

type TimeBlockExtractionResult = {
  block: TimeBlock;
  usage: AIUsageMetrics | null;
};

export function parseTimeBlockExtractionOutput(value: unknown): TimeBlock {
  return RawTimeBlockSchema.parse(value);
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function nextWeekdayDate(referenceDate: string, timezone: string | undefined, weekday: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(referenceDate));
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  if (!year || !month || !day) return null;

  const referenceDay = new Date(Date.UTC(year, month - 1, day));
  const targetDay = WEEKDAYS.findIndex((day) => day === weekday);
  if (targetDay === -1) return null;
  const delta = (targetDay - referenceDay.getUTCDay() + 7) % 7 || 7;
  const resolved = new Date(referenceDay.getTime() + delta * 24 * 60 * 60 * 1000);
  return resolved.toISOString().slice(0, 10);
}

function replaceIsoDate(value: string | null, date: string | null) {
  return value && date ? value.replace(/^\d{4}-\d{2}-\d{2}/, date) : value;
}

export function normalizeExplicitWeekday(
  block: TimeBlock,
  input: TimeBlockExtractionInput,
): TimeBlock {
  const matches = [
    ...input.transcript
      .toLowerCase()
      .matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g),
  ];
  const weekday = matches.at(-1)?.[1];
  if (!weekday || (!block.start_time && !block.end_time)) return block;

  const date = nextWeekdayDate(input.referenceDate, input.timezone, weekday);
  if (!date) return block;
  return {
    ...block,
    start_time: replaceIsoDate(block.start_time, date),
    end_time: replaceIsoDate(block.end_time, date),
  };
}

function offsetMinutesAt(instantMs: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60000);
}

// Models often keep the reference date's UTC offset on a date across a daylight
// saving change. A value with a numeric offset keeps the local wall-clock time
// the model chose and gets the offset that applies on that date in the user's
// time zone; a UTC ("Z") value is converted to the same instant in that zone.
export function normalizeOffset(value: string | null, timezone: string | undefined) {
  const match = value?.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!value || !timezone || !match) return value;
  try {
    const [, year, month, day, hour, minute, second, designator] = match;
    const parsed = Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!, +second!);
    let wallMs = parsed;
    let offset: number;
    if (designator === 'Z') {
      offset = offsetMinutesAt(parsed, timezone);
      wallMs = parsed + offset * 60000;
    } else {
      offset = offsetMinutesAt(parsed, timezone);
      offset = offsetMinutesAt(parsed - offset * 60000, timezone);
    }
    const local = new Date(wallMs).toISOString().slice(0, 19);
    const sign = offset < 0 ? '-' : '+';
    const abs = Math.abs(offset);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  } catch {
    return value;
  }
}

export function normalizeOffsets(block: TimeBlock, timezone: string | undefined): TimeBlock {
  return {
    ...block,
    start_time: normalizeOffset(block.start_time, timezone),
    end_time: normalizeOffset(block.end_time, timezone),
    scheduling_window_start: normalizeOffset(block.scheduling_window_start, timezone),
    scheduling_window_end: normalizeOffset(block.scheduling_window_end, timezone),
  };
}

export async function extractTimeBlock(
  input: TimeBlockExtractionInput,
  systemPrompt: string,
): Promise<TimeBlockExtractionResult> {
  const model = input.model ?? TIME_BLOCK_EXTRACTION_MODEL;
  const context = [
    `Current date and time: ${input.referenceDate}`,
    input.timezone ? `Timezone: ${input.timezone}` : null,
    input.conversationContext ? `Conversation context:\n${input.conversationContext}` : null,
    input.calendarContext ? `Calendar context:\n${input.calendarContext}` : null,
    `User input: ${input.transcript}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const { output, usage } = await createStructuredChatCompletion(
      {
        model,
        schema: RawTimeBlockSchema,
        schemaName: 'time_block_extraction',
        schemaDescription: 'A single structured time block extracted from natural language.',
        reasoning: getReasoningConfig(model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context },
        ],
      },
      input,
    );

    const block = normalizeOffsets(
      normalizeExplicitWeekday(parseTimeBlockExtractionOutput(output), input),
      input.timezone,
    );
    return { block, usage };
  } catch (error) {
    if (error instanceof StructuredOutputError) throw error;
    throw normalizeOpenRouterError(error);
  }
}
