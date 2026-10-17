import { redis } from '@hominem/services/redis';
import { logger } from '@hominem/telemetry';
import { Queue, Worker } from 'bullmq';

import { syncAirportCatalogue } from '../application/airport-catalogue.service';

let worker: Worker | null = null;
export async function startAirportCatalogueSyncWorker() {
  if (worker) return worker;
  const queue = new Queue('airport-catalogue-sync', { connection: redis });
  await queue.upsertJobScheduler('nightly', { pattern: '0 3 * * *' }, { name: 'sync' });
  await queue.add('sync', {}, { jobId: 'airport-catalogue-initial-sync' });
  worker = new Worker('airport-catalogue-sync', async () => syncAirportCatalogue(), {
    connection: redis,
    concurrency: 1,
  });
  worker.on('completed', (job, result) =>
    logger.info('airport_catalogue_sync_completed', { jobId: job.id, result }),
  );
  worker.on('failed', (job, error) =>
    logger.error('airport_catalogue_sync_failed', { jobId: job?.id, error }),
  );
  return worker;
}
