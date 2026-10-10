import { expect, test } from 'bun:test';

import { assertJobImportOutput } from './career-compare';

const validPayload = {
  jobTitle: 'AI Tooling Engineer',
  companyName: 'Whatnot',
  companyDescription: 'Whatnot helps sellers.',
  jobDescription: 'Build internal tools.',
  location: 'San Francisco, CA',
  salaryRange: '$200K – $260K',
  salaryDetails: '',
  employmentType: 'FullTime',
  experienceLevel: '',
  education: '',
  requirements: [],
  skills: [],
  benefits: [],
  responsibilities: [],
  industry: '',
  postedDate: '',
  applicationDeadline: '',
  department: 'Engineering',
  hiringManager: '',
  companySize: '',
  fundingStage: '',
  technologyStack: [],
  cultureAspects: [],
  fullText:
    'Whatnot helps sellers across hundreds of categories with live commerce tools built for speed and reliability.\n\nBuild internal tools, prototypes, and automated workflows that help every team use dependable AI safely.',
};

test('accepts a complete posting and reports a missing reference span', () => {
  assertJobImportOutput(JSON.stringify(validPayload), JSON.stringify(validPayload));

  let failure = '';
  try {
    assertJobImportOutput(
      JSON.stringify({
        ...validPayload,
        fullText:
          'Whatnot helps sellers across hundreds of categories with live commerce tools built for speed and reliability.',
      }),
      JSON.stringify(validPayload),
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  expect(failure).toContain('omitted 1 reference span');
});

test('accepts the checked-in career fixtures as internally consistent', async () => {
  const goldens: Array<{ expectedOutput: string }> = JSON.parse(
    await Bun.file(new URL('../../data/career-job-import/goldens.json', import.meta.url)).text(),
  );

  expect(goldens.length).toEqual(2);
  for (const golden of goldens) {
    assertJobImportOutput(golden.expectedOutput, golden.expectedOutput);
  }
});

test('rejects invalid shapes before judging semantics', () => {
  let failure = '';
  try {
    assertJobImportOutput(
      JSON.stringify({ ...validPayload, requirements: 'shipping' }),
      JSON.stringify(validPayload),
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  expect(failure).toContain('requirements must be an array of strings');
});
