// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countRender,
  recordCommit,
  startFrameSampler,
  startRecording,
  stopRecording,
  summarizeDurations,
} from '~/services/perf/stream-perf';

describe('stream-perf', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
  });
  afterEach(() => {
    stopRecording();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('ignores counters until a recording starts', () => {
    countRender('Row');
    recordCommit(5);
    startRecording();
    expect(stopRecording()).toEqual({ renders: {}, commits: 0, commitMs: 0, maxCommitMs: 0 });
  });

  it('counts renders per name and totals commit time', () => {
    startRecording();
    countRender('Row');
    countRender('Row');
    countRender('List');
    recordCommit(2);
    recordCommit(6);
    expect(stopRecording()).toEqual({
      renders: { Row: 2, List: 1 },
      commits: 2,
      commitMs: 8,
      maxCommitMs: 6,
    });
  });

  it('summarizes durations', () => {
    const summary = summarizeDurations([1, 2, 3, 4, 100]);
    expect(summary).toEqual({ count: 5, avgMs: 22, p95Ms: 100, maxMs: 100 });
    expect(summarizeDurations([])).toEqual({ count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 });
  });

  it('measures frame gaps and flags janky frames', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.stubGlobal('performance', { now: () => now });
    const callbacks: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => callbacks.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const stop = startFrameSampler();
    for (const gap of [16, 16, 50, 120]) {
      now += gap;
      callbacks.shift()?.();
    }
    const result = stop();

    expect(result.frames).toBe(4);
    expect(result.maxGapMs).toBe(120);
    expect(result.jank33).toBe(2);
    expect(result.frozen100).toBe(1);
    expect(result.jsFps).toBeCloseTo(4 / 0.202, 0);
  });
});
