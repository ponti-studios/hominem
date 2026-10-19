import { logger } from '@hominem/telemetry';

import { redis } from './redis';
import type { BaseJob } from './types';

export const IMPORT_JOBS_LIST_KEY = 'import:active-jobs';
export const IMPORT_JOB_PREFIX = 'import:job:';
export const USER_JOBS_PREFIX = 'import:user:';
export const JOB_EXPIRATION_TIME = 60 * 60; // 1 hour

export async function getJobStatus<T>(jobId: string): Promise<T | null> {
  try {
    const job = await redis.get(`${IMPORT_JOB_PREFIX}${jobId}`);
    const parsed: T | null = job ? JSON.parse(job) : null;
    return parsed;
  } catch (error) {
    logger.error('queue_job_status_lookup_failed', {
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}

export async function removeJobFromQueue(jobId: string, userId?: string) {
  let user: string | undefined = userId;

  if (!user) {
    const job = await getJobStatus<BaseJob>(jobId);
    user = job?.userId;
  }

  const pipeline = redis.pipeline();

  pipeline.del(`${IMPORT_JOB_PREFIX}${jobId}:csv`);

  pipeline.del(`${IMPORT_JOB_PREFIX}${jobId}`);

  pipeline.srem(IMPORT_JOBS_LIST_KEY, jobId);

  if (user) {
    pipeline.zrem(`${USER_JOBS_PREFIX}${user}`, jobId);
  }

  await pipeline.exec();
}

export async function getUserJobs<T extends BaseJob<string>>(
  userId: string,
  page = 1,
  limit = 20,
): Promise<{ jobs: T[]; total: number; page: number; pages: number }> {
  try {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;

    const total = await redis.zcard(`${USER_JOBS_PREFIX}${userId}`);

    if (total === 0) {
      return { jobs: [], total: 0, page, pages: 0 };
    }

    const jobIds = await redis.zrevrange(`${USER_JOBS_PREFIX}${userId}`, startIndex, endIndex);

    if (!jobIds.length) {
      return { jobs: [], total, page, pages: Math.ceil(total / limit) };
    }

    const jobResults: Array<T | null> = await Promise.all(
      jobIds.map((jobId: string) => getJobStatus<T>(jobId)),
    );

    const validJobs = jobResults.filter((job): job is T => job !== null);

    return {
      jobs: validJobs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('queue_user_jobs_lookup_failed', {
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return { jobs: [], total: 0, page, pages: 0 };
  }
}

export async function updateImportJob<T extends BaseJob<string>>(
  jobId: string,
  job: T,
): Promise<void> {
  await redis.set(`${IMPORT_JOB_PREFIX}${jobId}`, JSON.stringify(job), 'EX', JOB_EXPIRATION_TIME);
}

export async function createImportJob<T extends BaseJob<string>>(job: T): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.set(`${IMPORT_JOB_PREFIX}${job.jobId}`, JSON.stringify(job), 'EX', JOB_EXPIRATION_TIME);
  pipeline.zadd(`${USER_JOBS_PREFIX}${job.userId}`, Date.now(), job.jobId);
  pipeline.sadd(IMPORT_JOBS_LIST_KEY, job.jobId);
  await pipeline.exec();
}

export async function publishImportProgress<T>(data: T): Promise<void> {
  await redis.publish('import:progress', JSON.stringify({ type: 'import:progress', data }));
}

export async function getActiveJobs<T extends BaseJob<string>>(): Promise<T[]> {
  try {
    const jobIds = await redis.smembers(IMPORT_JOBS_LIST_KEY);
    if (!jobIds.length) {
      return [];
    }

    const jobs = await getJobsByIds<T>(jobIds);

    const now = Date.now();
    const jobsToRemove = jobs.filter((job) => {
      const isDone = job.status === 'done' || job.status === 'error' || job.status === 'cancelled';
      const isOld = job.endTime && now - job.endTime > 10 * 60 * 1000; // done more than 10 min ago
      return isDone && isOld;
    });

    if (jobsToRemove.length > 0) {
      const jobIdsToRemove = jobsToRemove.map((job) => job.jobId);
      await redis.srem(IMPORT_JOBS_LIST_KEY, ...jobIdsToRemove);
    }

    return jobs;
  } catch (error) {
    logger.error('Failed to get active jobs', { error });
    return [];
  }
}

export async function getJobsByIds<T extends BaseJob<string>>(jobIds: string[]): Promise<T[]> {
  try {
    const jobs = await Promise.all(
      jobIds.map(async (jobId) => {
        const job = await getJobStatus<T>(jobId);
        return job;
      }),
    );
    return jobs.filter((job): job is Awaited<T> => !!job);
  } catch {
    return [];
  }
}

export async function getQueuedJobs<T extends BaseJob<string>>(): Promise<T[]> {
  try {
    const jobIds = await redis.smembers(IMPORT_JOBS_LIST_KEY);
    if (!jobIds.length) {
      return [];
    }

    const jobs = await getJobsByIds<T>(jobIds);

    return jobs.filter((job) => job.status === 'queued');
  } catch (error) {
    logger.error('Failed to get queued jobs', { error });
    return [];
  }
}
