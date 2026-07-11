import { describe, expect, it } from 'vitest';
import { buildEvidence, logRedaction, noData } from './evidence';

describe('evidence utilities', () => {
  describe('noData', () => {
    it('returns empty evidence with isTruncated false', () => {
      expect(noData()).toEqual({ evidence: [], isTruncated: false });
    });
  });

  describe('buildEvidence', () => {
    it('returns all results when under cap', () => {
      const results = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const envelope = buildEvidence(results, 'test-tool', 10);
      expect(envelope.evidence).toEqual(results);
      expect(envelope.isTruncated).toBe(false);
    });

    it('returns exactly cap results when equal', () => {
      const results = [1, 2, 3, 4, 5];
      const envelope = buildEvidence(results, 'test-tool', 5);
      expect(envelope.evidence).toHaveLength(5);
      expect(envelope.isTruncated).toBe(false);
    });

    it('truncates and marks isTruncated when over cap', () => {
      const results = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const envelope = buildEvidence(results, 'test-tool', 3);
      expect(envelope.evidence).toEqual([1, 2, 3]);
      expect(envelope.isTruncated).toBe(true);
    });

    it('handles empty results', () => {
      const envelope = buildEvidence([], 'test-tool', 5);
      expect(envelope.evidence).toEqual([]);
      expect(envelope.isTruncated).toBe(false);
    });
  });

  describe('logRedaction', () => {
    it('does not throw', () => {
      expect(() => logRedaction('test-tool', ['salary', 'email'], 5)).not.toThrow();
    });

    it('does not throw with empty redacted fields', () => {
      expect(() => logRedaction('test-tool', [], 0)).not.toThrow();
    });
  });
});
