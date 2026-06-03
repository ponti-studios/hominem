import { describe, expect, it } from 'vitest';

import {
  formatApplicationDate,
  formatApplicationSalary,
  formatStatusText,
  getCompanyName,
  getStatusColor,
  getUniqueSources,
  getUniqueStatuses,
  hasActiveFilters,
} from '../applicationUtils';

describe('Application Utils', () => {
  describe('getCompanyName', () => {
    it('should return "Unknown Company" for null/undefined input', () => {
      expect(getCompanyName(null)).toBe('Unknown Company');
      expect(getCompanyName(undefined)).toBe('Unknown Company');
    });

    it('should return the string directly if company is a string', () => {
      expect(getCompanyName('Google')).toBe('Google');
      expect(getCompanyName('Microsoft Corporation')).toBe('Microsoft Corporation');
    });

    it('should return company.name if company is an object with name property', () => {
      expect(getCompanyName({ name: 'Apple Inc.' })).toBe('Apple Inc.');
    });

    it('should return "Unknown Company" if company object has no name or empty name', () => {
      expect(getCompanyName({ name: '' })).toBe('Unknown Company');
      expect(getCompanyName({} as { name: string })).toBe('Unknown Company');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for known statuses', () => {
      expect(getStatusColor('APPLIED')).toBe('border-accent/30 bg-accent/10 text-foreground');
      expect(getStatusColor('PHONE_SCREEN')).toBe(
        'border-warning/30 bg-warning/10 text-foreground',
      );
      expect(getStatusColor('INTERVIEW')).toBe('border-accent/30 bg-accent/10 text-foreground');
      expect(getStatusColor('FINAL_INTERVIEW')).toBe(
        'border-accent/40 bg-accent/15 text-foreground',
      );
      expect(getStatusColor('OFFER')).toBe('border-success/30 bg-success/10 text-foreground');
      expect(getStatusColor('ACCEPTED')).toBe('border-success/40 bg-success/15 text-foreground');
      expect(getStatusColor('REJECTED')).toBe(
        'border-destructive/30 bg-destructive/10 text-foreground',
      );
      expect(getStatusColor('WITHDRAWN')).toBe('bg-muted text-foreground');
    });

    it('should return default gray color for unknown statuses', () => {
      expect(getStatusColor('UNKNOWN_STATUS')).toBe('bg-muted text-foreground');
      expect(getStatusColor('')).toBe('bg-muted text-foreground');
    });
  });

  describe('formatApplicationDate', () => {
    it('should return "—" for null/undefined dates', () => {
      expect(formatApplicationDate(null)).toBe('—');
      expect(formatApplicationDate(undefined)).toBe('—');
    });

    it('should format Date objects correctly', () => {
      const date = new Date('2024-03-15');
      const result = formatApplicationDate(date);
      expect(result).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/); // Format: "Mar 15, 2024"
    });

    it('should format date strings correctly', () => {
      const result = formatApplicationDate('2024-03-15');
      expect(result).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/);
    });

    it('should handle ISO date strings', () => {
      const result = formatApplicationDate('2024-03-15T10:30:00Z');
      expect(result).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/);
    });
  });

  describe('formatApplicationSalary', () => {
    it('should return "—" for null/undefined/empty values', () => {
      expect(formatApplicationSalary(null)).toBe('—');
      expect(formatApplicationSalary(undefined)).toBe('—');
      expect(formatApplicationSalary(0)).toBe('—');
    });

    it('should return string values as-is', () => {
      expect(formatApplicationSalary('$120,000 - $150,000')).toBe('$120,000 - $150,000');
      expect(formatApplicationSalary('Negotiable')).toBe('Negotiable');
    });

    it('should format numeric values using currency formatting', () => {
      expect(formatApplicationSalary(12000000)).toBe('$120,000'); // 120k in cents
    });
  });

  describe('getUniqueStatuses', () => {
    it('should return unique statuses sorted alphabetically', () => {
      const applications = [
        { status: 'APPLIED' },
        { status: 'INTERVIEW' },
        { status: 'APPLIED' },
        { status: 'OFFER' },
        { status: 'INTERVIEW' },
      ];

      const result = getUniqueStatuses(applications);
      expect(result).toEqual(['APPLIED', 'INTERVIEW', 'OFFER']);
    });

    it('should handle empty array', () => {
      expect(getUniqueStatuses([])).toEqual([]);
    });

    it('should handle single status', () => {
      const applications = [{ status: 'APPLIED' }];
      expect(getUniqueStatuses(applications)).toEqual(['APPLIED']);
    });
  });

  describe('getUniqueSources', () => {
    it('should return unique sources, filtered and sorted', () => {
      const applications = [
        { source: 'LinkedIn' },
        { source: 'Indeed' },
        { source: null },
        { source: 'LinkedIn' },
        { source: undefined },
        { source: 'Company Website' },
      ];

      const result = getUniqueSources(applications);
      expect(result).toEqual(['Company Website', 'Indeed', 'LinkedIn']);
    });

    it('should handle empty array', () => {
      expect(getUniqueSources([])).toEqual([]);
    });

    it('should filter out null and undefined values', () => {
      const applications = [{ source: null }, { source: undefined }];
      expect(getUniqueSources(applications)).toEqual([]);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false when no filters are active', () => {
      expect(hasActiveFilters({})).toBe(false);
      expect(hasActiveFilters({ search: '', statuses: [], source: undefined })).toBe(false);
    });

    it('should return true when search filter is active', () => {
      expect(hasActiveFilters({ search: 'engineer' })).toBe(true);
    });

    it('should return true when status filters are active', () => {
      expect(hasActiveFilters({ statuses: ['APPLIED'] })).toBe(true);
      expect(hasActiveFilters({ statuses: ['APPLIED', 'INTERVIEW'] })).toBe(true);
    });

    it('should return true when source filter is active', () => {
      expect(hasActiveFilters({ source: 'LinkedIn' })).toBe(true);
    });

    it('should return true when multiple filters are active', () => {
      expect(
        hasActiveFilters({
          search: 'engineer',
          statuses: ['APPLIED'],
          source: 'LinkedIn',
        }),
      ).toBe(true);
    });
  });

  describe('formatStatusText', () => {
    it('should replace underscores with spaces', () => {
      expect(formatStatusText('PHONE_SCREEN')).toBe('PHONE SCREEN');
      expect(formatStatusText('FINAL_INTERVIEW')).toBe('FINAL INTERVIEW');
    });

    it('should handle statuses without underscores', () => {
      expect(formatStatusText('APPLIED')).toBe('APPLIED');
      expect(formatStatusText('OFFER')).toBe('OFFER');
    });

    it('should handle empty strings', () => {
      expect(formatStatusText('')).toBe('');
    });

    it('should replace all underscores', () => {
      expect(formatStatusText('TEST_STATUS_WITH_MULTIPLE')).toBe('TEST STATUS WITH MULTIPLE');
    });
  });
});
