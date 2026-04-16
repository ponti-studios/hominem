import { logger } from '@hominem/utils/logger';

import { initRuntime } from './runtime';
import { startFileProcessingWorker } from './workers/file-processing';

const fileProcessingWorker = startFileProcessingWorker();

initRuntime('hominem-worker').installSignalHandlers([() => fileProcessingWorker.close()]);

logger.info('worker_started', { queue: 'file-processing' });
