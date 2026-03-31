import { redis } from '@hominem/services/redis';
import { QUEUE_NAMES } from '@hominem/utils/consts';
import { logger } from '@hominem/utils/logger';
import { context, metrics, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';

import { HealthService } from './health.service';

interface ObservabilitySmokeJobData {
  payload: string;
  telemetry?: {
    traceparent?: string;
    baggage?: string;
    flowId?: string;
  };
}

export interface WorkerRuntime {
  close(): Promise<void>;
}

interface ObservabilityTelemetry {
  tracer: ReturnType<typeof trace.getTracer>;
  jobCounter: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']>;
  jobDuration: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
}

async function processObservabilitySmokeJob(
  job: Job<ObservabilitySmokeJobData>,
  telemetry: ObservabilityTelemetry,
) {
  const startedAt = performance.now();
  const parentContext = propagation.extract(context.active(), {
    ...(job.data?.telemetry?.traceparent ? { traceparent: job.data.telemetry.traceparent } : {}),
    ...(job.data?.telemetry?.baggage ? { baggage: job.data.telemetry.baggage } : {}),
  });

  return telemetry.tracer.startActiveSpan(
    'bullmq.process observability-smoke',
    {
      attributes: {
        'messaging.system': 'bullmq',
        'messaging.destination': QUEUE_NAMES.OBSERVABILITY_SMOKE,
        'messaging.operation': 'process',
        'messaging.message.id': String(job.id ?? 'unknown'),
        'messaging.destination.name': QUEUE_NAMES.OBSERVABILITY_SMOKE,
        ...(job.data?.telemetry?.flowId
          ? {
              'messaging.message.conversation_id': job.data.telemetry.flowId,
              'hominem.observability.flow_id': job.data.telemetry.flowId,
            }
          : {}),
      },
    },
    parentContext,
    async (span) => {
      try {
        logger.info('observability_smoke_job_started', {
          flowId: job.data?.telemetry?.flowId,
          jobId: job.id,
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        telemetry.jobCounter.add(1, {
          'messaging.destination': QUEUE_NAMES.OBSERVABILITY_SMOKE,
          'job.status': 'completed',
        });
        telemetry.jobDuration.record(Math.max(0, performance.now() - startedAt), {
          'messaging.destination': QUEUE_NAMES.OBSERVABILITY_SMOKE,
          'job.status': 'completed',
        });

        logger.info('observability_smoke_job_completed', {
          flowId: job.data?.telemetry?.flowId,
          jobId: job.id,
          payloadLength: job.data?.payload.length ?? 0,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return { ok: true };
      } catch (error) {
        telemetry.jobCounter.add(1, {
          'messaging.destination': QUEUE_NAMES.OBSERVABILITY_SMOKE,
          'job.status': 'failed',
        });
        telemetry.jobDuration.record(Math.max(0, performance.now() - startedAt), {
          'messaging.destination': QUEUE_NAMES.OBSERVABILITY_SMOKE,
          'job.status': 'failed',
        });
        span.setAttribute('error.type', error instanceof Error ? error.name : 'UnknownError');
        span.setAttribute(
          'error.message',
          error instanceof Error ? error.message : 'Unknown observability smoke worker error',
        );
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export async function startObservabilitySmokeWorker(): Promise<WorkerRuntime> {
  const tracer = trace.getTracer('hominem-workers-observability-smoke');
  const meter = metrics.getMeter('hominem-workers-observability-smoke');
  const telemetry: ObservabilityTelemetry = {
    tracer,
    jobCounter: meter.createCounter('hominem_worker_jobs_total', {
      description: 'Total observability smoke jobs processed by the worker',
    }),
    jobDuration: meter.createHistogram('hominem_worker_job_duration_ms', {
      description: 'Duration of observability smoke worker job processing in milliseconds',
      unit: 'ms',
    }),
  };

  const worker = new Worker<ObservabilitySmokeJobData>(
    QUEUE_NAMES.OBSERVABILITY_SMOKE,
    (job) => processObservabilitySmokeJob(job, telemetry),
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: redis as any,
      concurrency: 1,
    },
  );

  const health = new HealthService(worker, 'Observability Smoke Worker');

  worker.on('completed', (job) => {
    logger.info('observability_smoke_worker_completed', { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    logger.error('observability_smoke_worker_failed', { error, jobId: job?.id });
  });

  worker.on('error', (error) => {
    logger.error('observability_smoke_worker_error', { error });
  });

  await worker.waitUntilReady();
  logger.info('observability_smoke_worker_ready', {
    queueName: QUEUE_NAMES.OBSERVABILITY_SMOKE,
  });

  return {
    async close() {
      await health.stop();
      await worker.close();
    },
  };
}