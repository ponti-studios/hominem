import { createServer } from 'node:http';

import { logger } from '@hominem/telemetry';

import { initRuntime } from './runtime';
import { startFileProcessingWorker } from './workers/file-processing';

const fileProcessingWorker = startFileProcessingWorker();

const healthServer = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(Number(process.env.PORT ?? 3001));

initRuntime('worker').installSignalHandlers([
  () => fileProcessingWorker.close(),
  () => new Promise<void>((resolve) => healthServer.close(() => resolve())),
]);

logger.info('worker_started', { queue: 'file-processing' });
