import { logger } from '@hakumi/utils/logger';

import { initRuntime } from './runtime';
import { startFileProcessingWorker } from './workers/file-processing';

const fileProcessingWorker = startFileProcessingWorker();

initRuntime('hakumi-worker').installSignalHandlers([() => fileProcessingWorker.close()]);

logger.info('worker_started', { queue: 'file-processing' });
