import { db } from '@hominem/db/core';
import { GoalsRepository } from '@hominem/db/goals';
import type { ProactivityDependencies } from '@hominem/proactivity';
import { logger } from '@hominem/telemetry';

import { runEvaluation } from './proactivity.service';

/**
 * One scheduled pass per owner per UTC day, named by the day it covers. The
 * journal makes a repeat of the same day's sweep a no-op, so the worker can
 * tick more often than the cadence without spending model calls twice.
 */
export function scheduledTriggerId(now: Date): string {
  return `scheduled-${now.toISOString().slice(0, 10)}`;
}

export type ScheduledPassResult = { owners: number; evaluated: number; failed: number };

/**
 * Sweeps every owner with an active goal through the same evaluator the manual
 * run uses. One owner's failure is logged and does not stop the pass.
 */
export async function runScheduledPass(options: {
  now: Date;
  slot?: ProactivityDependencies['slot'];
}): Promise<ScheduledPassResult> {
  const ownerIds = await GoalsRepository.listActiveOwnerIds(db);
  const asOf = options.now.toISOString();
  const triggerId = scheduledTriggerId(options.now);
  let evaluated = 0;
  let failed = 0;

  for (const ownerId of ownerIds) {
    try {
      const run = await runEvaluation(ownerId, {
        trigger: { kind: 'scheduled-pass', id: triggerId, ownerId, asOf },
        ...(options.slot ? { slot: options.slot } : {}),
      });
      if (run.evaluations.length > 0) evaluated += 1;
    } catch (error) {
      failed += 1;
      logger.error('proactivity_scheduled_pass_owner_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { owners: ownerIds.length, evaluated, failed };
}
