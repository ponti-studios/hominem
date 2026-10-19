// Needs to load before anything that reads process.env at import time (e.g.
// @hominem/queues' Redis client) - keep this import first, don't let auto-sort move it.
import 'dotenv/config';
import { createServer } from 'node:http';

import { QUEUE_NAMES, chatGenerationEffectsQueue } from '@hominem/queues';
import { logger } from '@hominem/telemetry';

import { startHoldSweeper } from './application/credit-settle.runtime';
import { env } from './env';
import { initRuntime } from './runtime';
import { startAirportCatalogueSyncWorker } from './workers/airport-catalogue-sync';
import { startCareerJobImportWorker } from './workers/career-job-import';
import { startChatFileCleanupWorker } from './workers/chat-file-cleanup';
import { startChatGenerationEffectsWorker } from './workers/chat-generation-effects';
import { startEmbeddingGenerationWorker } from './workers/embedding-generation';
import { startFileProcessingWorker } from './workers/file-processing';
import { startResumeAnalysisWorker } from './workers/resume-analysis';
import { startSpeechUsageReconciliationWorker } from './workers/speech-usage-reconciliation';

const fileProcessingWorker = startFileProcessingWorker();
const embeddingGenerationWorker = startEmbeddingGenerationWorker();
const resumeAnalysisWorker = startResumeAnalysisWorker();
const speechUsageReconciliationWorker = startSpeechUsageReconciliationWorker();
// Started here (not elsewhere) so dev watchers actually reload the queue handlers.
const careerJobImportWorker = startCareerJobImportWorker();
const chatFileCleanupWorker = startChatFileCleanupWorker();
const chatGenerationEffectsWorker = await startChatGenerationEffectsWorker();
const airportCatalogueSyncWorker = await startAirportCatalogueSyncWorker();
const stopHoldSweeper = startHoldSweeper();
const workerVersion = 'career-import-v2';

const healthServer = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.setHeader('x-worker-version', workerVersion);
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(env.PORT ?? env.WORKER_PORT ?? 4041);

initRuntime('worker').installSignalHandlers(
  async () => {
    stopHoldSweeper();
    await Promise.all([
      fileProcessingWorker.close(),
      embeddingGenerationWorker.close(),
      resumeAnalysisWorker.close(),
      speechUsageReconciliationWorker.close(),
      careerJobImportWorker.close(),
      chatFileCleanupWorker.close(),
      chatGenerationEffectsWorker.close(),
      chatGenerationEffectsQueue.close(),
      airportCatalogueSyncWorker.close(),
    ]);
  },
  () => new Promise<void>((resolve) => healthServer.close(() => resolve())),
);

logger.info('worker_started', { queue: 'file-processing' });
logger.info('worker_started', { queue: 'embedding-generation' });
logger.info('worker_started', { queue: QUEUE_NAMES.RESUME_ANALYSIS });
logger.info('worker_started', { queue: QUEUE_NAMES.CAREER_JOB_IMPORT });
logger.info('worker_started', { queue: QUEUE_NAMES.SPEECH_USAGE_RECONCILIATION });
logger.info('worker_started', { queue: QUEUE_NAMES.CHAT_FILE_CLEANUP });
logger.info('worker_started', { queue: QUEUE_NAMES.CHAT_GENERATION_EFFECTS });
logger.info('worker_started', { queue: 'airport-catalogue-sync' });
