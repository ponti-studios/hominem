import type { UpdateCompanyInput, UpdateJobApplicationInput } from '@hominem/db';

import { dollarsToCents } from '~/lib/career/queries/utils';
import { JobApplicationStatus } from '~/types/career';

export class ApplicationFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationFormError';
  }
}

export interface ParsedApplicationUpdate {
  application: UpdateJobApplicationInput;
  company?: UpdateCompanyInput;
}

const NULLABLE_STRING_FIELDS = [
  'location',
  'jobPosting',
  'jobPostingUrl',
  'source',
  'link',
  'salaryQuoted',
  'salaryAccepted',
  'equityOffered',
  'equityFinal',
  'companyNotes',
  'negotiationNotes',
  'rejectionReason',
  'withdrawalReason',
  'phoneScreen',
  'recruiterName',
  'recruiterEmail',
  'recruiterLinkedin',
  'resume',
] as const;

const DATE_FIELDS = [
  'startDate',
  'applicationDate',
  'responseDate',
  'firstInterviewDate',
  'offerDate',
  'decisionDate',
  'endDate',
] as const;

const CENTS_FIELDS = [
  'salaryExpected',
  'salaryRequested',
  'salaryOffered',
  'salaryNegotiated',
  'salaryFinal',
  'totalCompOffered',
  'totalCompFinal',
  'bonusOffered',
  'bonusFinal',
] as const;

const COMPANY_FIELD_MAP = {
  companyName: 'name',
  companyWebsite: 'website',
  companyIndustry: 'industry',
  companySize: 'size',
  companyLocation: 'location',
  companyDescription: 'description',
} as const;

const VALID_STATUSES = new Set(Object.values(JobApplicationStatus));

function getRaw(formData: FormData, key: string): string | null | undefined {
  if (!formData.has(key)) return undefined;
  const value = formData.get(key);
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new ApplicationFormError(`Invalid value for ${key}`);
  }
  return value;
}

function parseNullableString(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

function parseDateField(raw: string | null, field: string): Date | null {
  if (raw === null || raw.trim() === '') return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApplicationFormError(`Invalid date for ${field}`);
  }
  return date;
}

function parseCentsField(raw: string | null, field: string): number | null {
  if (raw === null || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) {
    throw new ApplicationFormError(`Invalid amount for ${field}`);
  }
  return dollarsToCents(dollars);
}

function parseCompanySize(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const size = Number(raw);
  if (!Number.isFinite(size) || !Number.isInteger(size) || size < 0) {
    throw new ApplicationFormError('Invalid company size');
  }
  return size;
}

/** Format cents for dollar inputs (e.g. 15000000 → "150000"). */
export function formatCentsInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `${cents / 100}`;
}

/** Format a date value for date inputs (YYYY-MM-DD). */
export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0] ?? '';
}

export function parseApplicationUpdateFormData(formData: FormData): ParsedApplicationUpdate {
  const application: UpdateJobApplicationInput = {};
  let hasApplicationField = false;

  const positionRaw = getRaw(formData, 'position');
  if (positionRaw !== undefined) {
    const position = parseNullableString(positionRaw);
    if (!position) {
      throw new ApplicationFormError('Position is required');
    }
    application.position = position;
    hasApplicationField = true;
  }

  const statusRaw = getRaw(formData, 'status');
  if (statusRaw !== undefined) {
    const status = parseNullableString(statusRaw);
    if (!status || !VALID_STATUSES.has(status as JobApplicationStatus)) {
      throw new ApplicationFormError('Invalid status');
    }
    application.status = status;
    hasApplicationField = true;
  }

  for (const field of NULLABLE_STRING_FIELDS) {
    const raw = getRaw(formData, field);
    if (raw === undefined) continue;
    application[field] = parseNullableString(raw);
    hasApplicationField = true;
  }

  for (const field of DATE_FIELDS) {
    const raw = getRaw(formData, field);
    if (raw === undefined) continue;
    if (field === 'startDate') {
      if (raw === null || raw.trim() === '') {
        throw new ApplicationFormError('Start date is required');
      }
      application.startDate = parseDateField(raw, field) as Date;
    } else {
      application[field] = parseDateField(raw, field);
    }
    hasApplicationField = true;
  }

  for (const field of CENTS_FIELDS) {
    const raw = getRaw(formData, field);
    if (raw === undefined) continue;
    application[field] = parseCentsField(raw, field);
    hasApplicationField = true;
  }

  if (formData.has('reference')) {
    const values = formData.getAll('reference').map(String);
    application.reference =
      values.includes('true') || values.includes('on') || values.includes('1');
    hasApplicationField = true;
  }

  const company: UpdateCompanyInput = {};
  let hasCompanyField = false;

  for (const [formKey, companyKey] of Object.entries(COMPANY_FIELD_MAP) as Array<
    [keyof typeof COMPANY_FIELD_MAP, (typeof COMPANY_FIELD_MAP)[keyof typeof COMPANY_FIELD_MAP]]
  >) {
    const raw = getRaw(formData, formKey);
    if (raw === undefined) continue;

    if (companyKey === 'name') {
      const name = parseNullableString(raw);
      if (!name) {
        throw new ApplicationFormError('Company name is required');
      }
      company.name = name;
    } else if (companyKey === 'size') {
      company.size = parseCompanySize(raw);
    } else if (companyKey === 'website') {
      company.website = parseNullableString(raw);
    } else if (companyKey === 'industry') {
      company.industry = parseNullableString(raw);
    } else if (companyKey === 'location') {
      company.location = parseNullableString(raw);
    } else {
      company.description = parseNullableString(raw);
    }
    hasCompanyField = true;
  }

  if (!hasApplicationField && !hasCompanyField) {
    throw new ApplicationFormError('No fields to update');
  }

  return {
    ...(hasApplicationField ? { application } : { application: {} }),
    ...(hasCompanyField ? { company } : {}),
  };
}
