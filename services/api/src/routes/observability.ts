import { redis } from '@hominem/services/redis';
import { QUEUE_NAMES } from '@hominem/utils/consts';
import { logger } from '@hominem/utils/logger';
import { zValidator } from '@hono/zod-validator';
import { context as otelContext, propagation } from '@opentelemetry/api';
import { Queue } from 'bullmq';
import { Hono } from 'hono';
import * as z from 'zod';

import { env } from '../env';
import { ForbiddenError, NotFoundError } from '../errors';
import type { AppEnv } from '../server';

const observabilitySmokeRequestSchema = z.object({
  flowId: z.string().min(1).max(128),
  payload: z.string().min(1).max(2000).default('observability smoke payload'),
});

const observabilitySmokeQueue = new Queue(QUEUE_NAMES.OBSERVABILITY_SMOKE, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: redis as any,
});

export const observabilityRoutes = new Hono<AppEnv>();

observabilityRoutes.post(
  '/worker-smoke',
  zValidator('json', observabilitySmokeRequestSchema),
  async (c) => {
    if (env.NODE_ENV === 'production') {
      throw new NotFoundError('route');
    }

    const providedSecret = c.req.header('x-e2e-auth-secret');
    if (!providedSecret || !env.AUTH_E2E_SECRET || providedSecret !== env.AUTH_E2E_SECRET) {
      throw new ForbiddenError('Forbidden');
    }

    const payload = c.req.valid('json');
    const carrier: Record<string, string> = {};
    const traceparent = c.req.header('traceparent');
    const baggage = c.req.header('baggage');

    if (traceparent) {
      carrier.traceparent = traceparent;
    }

    if (baggage) {
      carrier.baggage = baggage;
    }

    if (Object.keys(carrier).length === 0) {
      propagation.inject(otelContext.active(), carrier, {
        set: (target, key, value) => {
          target[key] = value;
        },
      });
    }

    const job = await observabilitySmokeQueue.add('observability-smoke', {
      payload: payload.payload,
      telemetry: {
        traceparent: carrier.traceparent,
        baggage: carrier.baggage,
        flowId: payload.flowId,
      },
    });

    logger.info('observability_worker_job_enqueued', {
      flowId: payload.flowId,
      jobId: job.id,
      queueName: QUEUE_NAMES.OBSERVABILITY_SMOKE,
    });

    return c.json({
      flowId: payload.flowId,
      jobId: String(job.id ?? ''),
      queueName: QUEUE_NAMES.OBSERVABILITY_SMOKE,
    });
  },
);