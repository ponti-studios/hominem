import { BillingRepository } from '@hominem/db/billing';
import { db } from '@hominem/db/core';

import type { BillingStore } from './billing.service';

/** The database behind the billing rules, in the shape those rules ask for. */
export const dbBillingStore: BillingStore = {
  get: (userId) => BillingRepository.get(db, userId),
  getOsmiumMembership: (userId) => BillingRepository.getOsmiumMembership(db, userId),
  grantOsmiumMembership: (input) => BillingRepository.grantOsmiumMembership(db, input),
  revokeOsmiumMembership: (input) => BillingRepository.revokeOsmiumMembership(db, input),
  save: (input) => BillingRepository.save(input),
  recordUsageWithinLimit: (input) => BillingRepository.recordUsageWithinLimit(input),
  recordUsage: (input) => BillingRepository.recordUsage(db, input),
  usageCount: (input) => BillingRepository.usageCount(db, input),
};
