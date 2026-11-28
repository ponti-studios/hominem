import { createHash } from 'node:crypto';

import { db } from '@hominem/db/core';
import { FinanceDoctrineRepository } from '@hominem/db/finance';
import {
  doctrineImportInputSchema,
  syncDoctrineSchema,
} from '@hominem/finance-services/finance.doctrine.schema';

/**
 * Fingerprints the canonical doctrine. Zod parsing normalizes the contents
 * (defaults applied, trims run), and the parsed object's key order follows the
 * schema, so identical logical doctrine always hashes identically.
 */
function doctrineFingerprint(doctrine: unknown): string {
  return createHash('sha256').update(JSON.stringify(doctrine)).digest('hex');
}

export async function getSyncDoctrine(userId: string) {
  const row = await FinanceDoctrineRepository.findLatest(db, userId);
  if (!row) return { fingerprint: null, updatedAt: null, doctrine: null };
  return {
    fingerprint: row.fingerprint,
    updatedAt: row.updatedAt,
    doctrine: syncDoctrineSchema.parse(row.contents),
  };
}

export async function importSyncDoctrine(userId: string, input: unknown) {
  const parsed = doctrineImportInputSchema.parse(input);
  const fingerprint = doctrineFingerprint(parsed.doctrine);
  const existing = await FinanceDoctrineRepository.findLatest(db, userId);

  const ruleCounts = {
    merchantRules: parsed.doctrine.merchantRules.length,
    tagRules: parsed.doctrine.tagRules.length,
    amountRules: parsed.doctrine.amountRules.length,
    transferMerchants: parsed.doctrine.transferMerchants.length,
    incomePatterns: parsed.doctrine.incomePatterns.length,
    coffeePatterns: parsed.doctrine.coffeePatterns.length,
    lenses: parsed.doctrine.lenses.length,
  };

  if (!existing) {
    if (parsed.dryRun) {
      return { fingerprint, status: 'created' as const, updatedAt: null, dryRun: true, ruleCounts };
    }
    const saved = await FinanceDoctrineRepository.upsert(db, userId, fingerprint, parsed.doctrine);
    return {
      fingerprint,
      status: 'created' as const,
      updatedAt: saved.updatedAt,
      dryRun: false,
      ruleCounts,
    };
  }

  if (existing.fingerprint === fingerprint) {
    return {
      fingerprint,
      status: 'unchanged' as const,
      updatedAt: existing.updatedAt,
      // Nothing would be written either way; echo the requested mode.
      dryRun: parsed.dryRun,
      ruleCounts,
    };
  }

  if (parsed.dryRun) {
    return {
      fingerprint,
      status: 'replaced' as const,
      updatedAt: existing.updatedAt,
      dryRun: true,
      ruleCounts,
    };
  }

  const saved = await FinanceDoctrineRepository.upsert(db, userId, fingerprint, parsed.doctrine);
  return {
    fingerprint,
    status: 'replaced' as const,
    updatedAt: saved.updatedAt,
    dryRun: false,
    ruleCounts,
  };
}
