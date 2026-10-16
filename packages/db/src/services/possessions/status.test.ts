import { describe, expect, it } from 'vitest';

import { ARCHIVED_STATUSES, CANONICAL_STATUSES, canonicalizeStatus } from './status';

describe('canonicalizeStatus', () => {
  it('leaves the canonical lifecycle untouched', () => {
    for (const status of CANONICAL_STATUSES) {
      expect(canonicalizeStatus(status)).toEqual({ status, isArchived: false });
    }
  });

  it('maps the Possessions active states onto the Still path', () => {
    expect(canonicalizeStatus('in_use')).toEqual({ status: 'owned', isArchived: false });
  });

  it('maps the end states onto Owned + archived, keeping the reason', () => {
    for (const reason of ARCHIVED_STATUSES) {
      expect(canonicalizeStatus(reason)).toEqual({
        status: 'owned',
        isArchived: true,
        archivedReason: reason,
      });
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(canonicalizeStatus('  IN_USE ')).toEqual({ status: 'owned', isArchived: false });
    expect(canonicalizeStatus('Retired')).toEqual({
      status: 'owned',
      isArchived: true,
      archivedReason: 'retired',
    });
  });

  it('never archives a null, empty, or unknown status', () => {
    for (const value of [null, undefined, '', '   ', 'something-the-owner-invented']) {
      expect(canonicalizeStatus(value)).toEqual({ status: 'owned', isArchived: false });
    }
  });

  it('carries an explicit archived flag on a canonical status', () => {
    expect(canonicalizeStatus('owned', true)).toEqual({ status: 'owned', isArchived: true });
  });
});
