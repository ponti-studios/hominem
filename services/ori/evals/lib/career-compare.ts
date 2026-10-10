const JOB_IMPORT_STRING_FIELDS = [
  'jobTitle',
  'companyName',
  'companyDescription',
  'jobDescription',
  'location',
  'salaryRange',
  'salaryDetails',
  'employmentType',
  'experienceLevel',
  'education',
  'industry',
  'postedDate',
  'applicationDeadline',
  'department',
  'hiringManager',
  'companySize',
  'fundingStage',
  'fullText',
] as const;

const JOB_IMPORT_ARRAY_FIELDS = [
  'requirements',
  'skills',
  'benefits',
  'responsibilities',
  'technologyStack',
  'cultureAspects',
] as const;

type JobImportRecord = Record<string, unknown>;

function isJobImportRecord(value: unknown): value is JobImportRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeJobEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeJobText(value: string): string {
  return decodeJobEntities(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function expectedTextSpans(fullText: string): string[] {
  return normalizeJobText(fullText)
    .split(/(?<=[.!?])\s+|\n\s*\n/g)
    .map((span) => span.trim())
    .filter((span) => span.length > 80);
}

/**
 * Checks the contract before judging semantics: the output must be JSON with the
 * production string/array shapes, and expected body spans must be retained in
 * source order. This isolates long-copy fidelity from field-level extraction
 * quality instead of folding both into one opaque judge score.
 */
export function assertJobImportOutput(output: string, expectedOutput: string): void {
  let parsed: unknown;
  let expected: unknown;
  try {
    parsed = JSON.parse(output);
    expected = JSON.parse(expectedOutput);
  } catch {
    throw new Error('job import output and reference output must both be valid JSON');
  }

  if (!isJobImportRecord(parsed) || !isJobImportRecord(expected)) {
    throw new Error('job import output and reference output must both be JSON objects');
  }

  for (const field of JOB_IMPORT_STRING_FIELDS) {
    if (typeof parsed[field] !== 'string') {
      throw new Error(`job import output field ${field} must be a string`);
    }
  }
  for (const field of JOB_IMPORT_ARRAY_FIELDS) {
    const values = parsed[field];
    if (!Array.isArray(values) || values.some((entry) => typeof entry !== 'string')) {
      throw new Error(`job import output field ${field} must be an array of strings`);
    }
  }

  const actualFullText = parsed.fullText;
  const expectedFullText = expected.fullText;
  if (typeof actualFullText !== 'string') {
    throw new Error('job import output field fullText must be a string');
  }
  if (typeof expectedFullText !== 'string' || expectedFullText.length === 0) {
    throw new Error('job import reference output must contain fullText');
  }

  const normalizedActual = normalizeJobText(actualFullText);
  let position = 0;
  const missing: string[] = [];
  for (const span of expectedTextSpans(expectedFullText)) {
    const index = normalizedActual.indexOf(span, position);
    if (index === -1) {
      missing.push(span.length > 120 ? `${span.slice(0, 120)}…` : span);
    } else {
      position = index + span.length;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `job import output omitted ${missing.length} reference span(s): ${missing.join(' | ')}`,
    );
  }
}
