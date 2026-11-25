import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getWorkflowStatus, listWorkflows, runWorkflow } from './runtime.ts';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-workflow-'));
  path = join(dir, 'agent.db');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('workflow runtime', () => {
  it('resumes failed workers without rerunning completed keys', async () => {
    const calls: Record<string, number> = {};
    const first = await runWorkflow({
      id: 'run-1',
      name: 'extract',
      path,
      items: [
        { key: 'batch-01', value: 1 },
        { key: 'batch-02', value: 2 },
        { key: 'batch-03', value: 3 },
      ],
      worker: async (value) => {
        calls[value] = (calls[value] ?? 0) + 1;
        if (value === 2 && calls[value] === 1) throw new Error('temporary failure');
        return value * 10;
      },
    });

    expect(first.status).toBe('failed');
    expect(first.done).toBe(2);
    expect(first.failed).toBe(1);
    expect(first.errors).toEqual([{ key: 'batch-02', message: 'temporary failure' }]);

    const resumed = await runWorkflow({
      id: 'run-1',
      name: 'extract',
      path,
      items: [
        { key: 'batch-01', value: 1 },
        { key: 'batch-02', value: 2 },
        { key: 'batch-03', value: 3 },
      ],
      worker: async (value) => {
        calls[value] = (calls[value] ?? 0) + 1;
        return value * 10;
      },
    });

    expect(resumed.status).toBe('completed');
    expect(resumed.skipped).toBe(2);
    expect(resumed.results).toEqual([
      { key: 'batch-01', value: 10 },
      { key: 'batch-02', value: 20 },
      { key: 'batch-03', value: 30 },
    ]);
    expect(calls).toEqual({ 1: 1, 2: 2, 3: 1 });
    expect(getWorkflowStatus('run-1', path).status).toBe('completed');
  });

  it('limits active workers to the requested concurrency', async () => {
    let active = 0;
    let maximum = 0;
    await runWorkflow({
      name: 'cluster',
      path,
      concurrency: 2,
      items: Array.from({ length: 5 }, (_, index) => ({ key: `worker-${index}`, value: index })),
      worker: async (value) => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return value;
      },
    });
    expect(maximum).toBe(2);
    expect(listWorkflows(path).map((run) => run.name)).toEqual(['cluster']);
  });

  it('refuses a resume with a changed worker set', async () => {
    await runWorkflow({
      id: 'run-fixed',
      name: 'extract',
      path,
      items: [{ key: 'batch-01', value: 1 }],
      worker: (value) => value,
    });
    await expect(
      runWorkflow({
        id: 'run-fixed',
        name: 'extract',
        path,
        items: [{ key: 'batch-02', value: 2 }],
        worker: (value) => value,
      }),
    ).rejects.toThrow('worker keys do not match');
    expect(getWorkflowStatus('run-fixed', path).results).toEqual([{ key: 'batch-01', value: 1 }]);
  });

  it('rejects duplicate stable keys before writing a run', async () => {
    await expect(
      runWorkflow({
        name: 'extract',
        path,
        items: [
          { key: 'same', value: 1 },
          { key: 'same', value: 2 },
        ],
        worker: (value) => value,
      }),
    ).rejects.toThrow('keys must be unique');
    expect(existsSync(path)).toBe(false);
  });
});
