import type { Golden } from './evaluator';

type TimeBlock = Record<string, unknown>;

const INSTANT_FIELDS = [
  'start_time',
  'end_time',
  'scheduling_window_start',
  'scheduling_window_end',
] as const;

const EXACT_FIELDS = ['primary_intent', 'duration', 'deadline_fixed'] as const;

const parseBlock = (text: string, message: string): TimeBlock => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(message);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(message);
  }
  return Object.fromEntries(Object.entries(parsed));
};

const norm = (value: unknown): string => String(value).trim().toLowerCase();

const nullable = (value: unknown): unknown => (value === undefined ? null : value);

// Datetimes are compared as instants so an equivalent UTC offset still matches.
const sameInstant = (actual: unknown, expected: unknown): boolean => {
  if (actual === null || expected === null) return actual === expected;
  return Date.parse(String(actual)) === Date.parse(String(expected));
};

const sameNames = (actual: unknown, expected: unknown): boolean => {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return actual === expected;
  const sorted = (items: unknown[]) => items.map(norm).sort().join('\u0000');
  return sorted(actual) === sorted(expected);
};

// "the office" and "office" name the same place.
const place = (value: unknown): string | null =>
  value === null ? null : norm(value).replace(/^(the|a|an)\s+/, '');

const rule = (value: unknown): string | null =>
  value === null
    ? null
    : String(value)
        .replace(/^RRULE:/i, '')
        .split(';')
        .sort()
        .join(';');

/**
 * Deterministic check of every structured field except `title`, which is the
 * only field that needs a judge. Throws one error naming the golden and every
 * mismatched field.
 */
export const assertTimeBlockFields = (output: string, golden: Golden): void => {
  const label = golden.name ?? golden.input;
  const actual = parseBlock(output, `${label}: output is not a JSON object`);
  const expected = parseBlock(golden.expectedOutput, `${label}: golden is not a JSON object`);
  const mismatches: string[] = [];
  const check = (field: string, ok: boolean) => {
    if (!ok) {
      mismatches.push(
        `${field}: expected ${JSON.stringify(expected[field])}, got ${JSON.stringify(nullable(actual[field]))}`,
      );
    }
  };

  for (const field of EXACT_FIELDS) {
    check(field, nullable(actual[field]) === expected[field]);
  }
  for (const field of INSTANT_FIELDS) {
    check(field, sameInstant(nullable(actual[field]), expected[field]));
  }
  check('participants', sameNames(nullable(actual.participants), expected.participants));
  check(
    'target_title',
    nullable(actual.target_title) === null || expected.target_title === null
      ? nullable(actual.target_title) === expected.target_title
      : norm(actual.target_title) === norm(expected.target_title),
  );
  check('location', place(nullable(actual.location)) === place(expected.location));
  check(
    'recurrence_rule',
    rule(nullable(actual.recurrence_rule)) === rule(expected.recurrence_rule),
  );

  if (mismatches.length > 0) {
    throw new Error(`${label}: ${mismatches.join('; ')}`);
  }
};

// Structured fields are asserted in code, so the judge only grades the title.
export const timeBlockTitleRubric = [
  'Grade only the title field. Ignore every other field; they are checked separately.',
  'The title must be a short label for the request. Harmless wording differences from the reference are fine.',
  'Fail if the reference title is null but the candidate invents a title, or if the reference has a title and the candidate title is null or names a different activity or person.',
].join('\n');
