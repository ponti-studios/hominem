import { describe, expect, it } from 'vitest';

import { JobApplicationStatus } from '~/types/career';

import {
  ApplicationFormError,
  formatCentsInput,
  formatDateInput,
  parseApplicationUpdateFormData,
} from '../applicationForm';

function form(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe('parseApplicationUpdateFormData', () => {
  it('maps core application fields and empties nullable strings to null', () => {
    const result = parseApplicationUpdateFormData(
      form({
        position: '  Staff Engineer  ',
        status: JobApplicationStatus.INTERVIEW,
        location: '',
        salaryQuoted: ' $120k ',
        source: '  LinkedIn  ',
      }),
    );

    expect(result.application).toMatchObject({
      position: 'Staff Engineer',
      status: JobApplicationStatus.INTERVIEW,
      location: null,
      salaryQuoted: '$120k',
      source: 'LinkedIn',
    });
    expect(result.company).toBeUndefined();
  });

  it('converts dollar amounts to cents', () => {
    const result = parseApplicationUpdateFormData(
      form({
        salaryExpected: '150000',
        salaryOffered: '$175,000',
        bonusOffered: '',
      }),
    );

    expect(result.application.salaryExpected).toBe(15_000_000);
    expect(result.application.salaryOffered).toBe(17_500_000);
    expect(result.application.bonusOffered).toBeNull();
  });

  it('parses dates and company fields with prefixes', () => {
    const result = parseApplicationUpdateFormData(
      form({
        startDate: '2024-03-15',
        applicationDate: '',
        companyName: 'Acme Corp',
        companyWebsite: 'https://acme.example',
        companySize: '250',
        companyLocation: '',
      }),
    );

    expect(result.application.startDate).toEqual(new Date('2024-03-15'));
    expect(result.application.applicationDate).toBeNull();
    expect(result.company).toEqual({
      name: 'Acme Corp',
      website: 'https://acme.example',
      size: 250,
      location: null,
    });
  });

  it('parses reference checkbox', () => {
    const result = parseApplicationUpdateFormData(form({ reference: 'on' }));
    expect(result.application.reference).toBe(true);
  });

  it('rejects empty position when provided', () => {
    expect(() => parseApplicationUpdateFormData(form({ position: '  ' }))).toThrow(
      ApplicationFormError,
    );
  });

  it('rejects invalid status', () => {
    expect(() => parseApplicationUpdateFormData(form({ status: 'NOPE' }))).toThrow(
      ApplicationFormError,
    );
  });

  it('rejects invalid cents amounts', () => {
    expect(() => parseApplicationUpdateFormData(form({ salaryExpected: 'abc' }))).toThrow(
      ApplicationFormError,
    );
  });

  it('rejects empty form data', () => {
    expect(() => parseApplicationUpdateFormData(form({}))).toThrow(ApplicationFormError);
  });
});

describe('format helpers', () => {
  it('formatCentsInput converts cents to dollar string', () => {
    expect(formatCentsInput(15_000_000)).toBe('150000');
    expect(formatCentsInput(null)).toBe('');
  });

  it('formatDateInput formats ISO dates', () => {
    expect(formatDateInput('2024-03-15T00:00:00.000Z')).toBe('2024-03-15');
    expect(formatDateInput(null)).toBe('');
  });
});
