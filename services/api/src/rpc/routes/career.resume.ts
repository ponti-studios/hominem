import {
  redis,
  REDIS_CHANNELS,
  type ResumeAnalysisJob,
  type ResumeAnalysisStage,
} from '@hominem/queues';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

import {
  CareerResumeError,
  applyResumeImport,
  convertResume,
  customizeResume,
  getResumeJob,
  startResumeAnalysis,
} from '../../application/career-resume.service';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { zValidator } from '../validator';

const RESUME_STAGE_INFO: Record<ResumeAnalysisStage, { label: string; percent: number }> = {
  queued: { label: 'Waiting to start…', percent: 5 },
  'pdf-extraction': { label: 'Reading your PDF…', percent: 20 },
  'ai-parse': { label: 'Asking the AI to parse it…', percent: 60 },
  'schema-validation': { label: 'Checking the parsed data…', percent: 80 },
  diffing: { label: 'Comparing with your current profile…', percent: 90 },
  done: { label: 'Ready to review', percent: 100 },
  error: { label: 'Something went wrong', percent: 100 },
};

const importSchema = z.object({
  jobId: z.string().min(1),
  scalarKeys: z.array(z.string()).default([]),
  listKeys: z.array(z.string()).default([]),
});

async function readResumeForm(c: {
  req: { formData: () => Promise<FormData> };
}): Promise<{ file?: File; fileId?: string; replaceExisting: boolean }> {
  const form = await c.req.formData();
  const pdf = form.get('pdf');
  const fileId = form.get('fileId');
  return {
    ...(pdf instanceof File ? { file: pdf } : {}),
    ...(typeof fileId === 'string' && fileId.trim() ? { fileId: fileId.trim() } : {}),
    replaceExisting: form.get('replaceExisting') === 'true',
  };
}

function resumeErrorResponse(c: Parameters<typeof jsonError>[0], error: unknown) {
  if (error instanceof CareerResumeError) {
    return jsonError(
      c,
      {
        error: error.message,
        stage: error.stage,
        retryable: error.retryable,
        fileUrl: error.fileUrl,
      },
      error.status,
    );
  }
  throw error;
}

function jsonError(
  c: { json: (body: unknown, status: ContentfulStatusCode) => Response },
  body: unknown,
  status: number,
) {
  return c.json(body, status as ContentfulStatusCode);
}

export const careerResumeRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .post(
    '/convert',
    rateLimitMiddleware({ bucket: 'career-resume-convert', windowSec: 3600, max: 20 }),
    async (c) => {
      try {
        return c.json(await convertResume(c.get('auth')!.userId, await readResumeForm(c)));
      } catch (error) {
        return resumeErrorResponse(c, error);
      }
    },
  )
  .post(
    '/analyze',
    rateLimitMiddleware({ bucket: 'career-resume-analyze', windowSec: 3600, max: 20 }),
    async (c) => {
      try {
        return c.json(await startResumeAnalysis(c.get('auth')!.userId, await readResumeForm(c)));
      } catch (error) {
        return resumeErrorResponse(c, error);
      }
    },
  )
  .post('/customize', async (c) => {
    const body: unknown = await c.req.json();
    return c.json(await customizeResume(c.get('auth')!.userId, body));
  })
  .post('/import', zValidator('json', importSchema), async (c) => {
    const { jobId, scalarKeys, listKeys } = c.req.valid('json');
    const result = await applyResumeImport(c.get('auth')!.userId, jobId, { scalarKeys, listKeys });
    return c.json({ success: true, ...result });
  })
  .get('/jobs/:id/stream', async (c) => {
    const userId = c.get('auth')!.userId;
    const jobId = c.req.param('id');
    const encoder = new TextEncoder();
    let subscriber: ReturnType<typeof redis.duplicate> | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          subscriber?.quit().catch(() => undefined);
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        const send = (job: ResumeAnalysisJob) => {
          if (closed) return;
          const info = RESUME_STAGE_INFO[job.stage];
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                jobId: job.jobId,
                stage: job.stage,
                label: info.label,
                percent: info.percent,
                error: job.status === 'error',
                errorMessage: job.error,
                diff: job.stage === 'done' ? job.diff : undefined,
              })}\n\n`,
            ),
          );
        };

        const snapshot = await getResumeJob(userId, jobId);
        if (!snapshot) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                jobId,
                stage: 'error',
                label: 'This analysis has expired or was not found — please upload again.',
                percent: 100,
                error: true,
              })}\n\n`,
            ),
          );
          close();
          return;
        }

        send(snapshot);
        if (
          snapshot.status === 'done' ||
          snapshot.status === 'error' ||
          snapshot.status === 'cancelled'
        ) {
          close();
          return;
        }

        subscriber = redis.duplicate();
        await subscriber.subscribe(REDIS_CHANNELS.IMPORT_PROGRESS);
        subscriber.on('message', (_channel: string, message: string) => {
          try {
            const parsed: { data?: ResumeAnalysisJob[] } = JSON.parse(message);
            const job = (parsed.data ?? []).find((entry) => entry.jobId === jobId);
            if (!job) return;
            send(job);
            if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled')
              close();
          } catch {
            // ignore malformed messages; the next snapshot remains authoritative
          }
        });
      },
      cancel() {
        subscriber?.quit().catch(() => undefined);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
