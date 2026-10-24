// Dev-only measurement for the streaming reply path. Counters are inert unless
// a bench run is recording, and every entry point bails out of production
// builds, so none of this costs anything for users.

type Recording = {
  renders: Record<string, number>;
  commits: number;
  commitMs: number;
  maxCommitMs: number;
};

let recording: Recording | null = null;

export function startRecording() {
  recording = { renders: {}, commits: 0, commitMs: 0, maxCommitMs: 0 };
}

export function stopRecording() {
  const finished = recording;
  recording = null;
  return finished;
}

// Call from a component body: counts how often that component re-rendered.
export function countRender(name: string) {
  if (!__DEV__ || !recording) {
    return;
  }
  recording.renders[name] = (recording.renders[name] ?? 0) + 1;
}

// Fed by <PerfProfiler>: React's own measure of time spent rendering the
// profiled subtree per commit.
export function recordCommit(actualDuration: number) {
  if (!__DEV__ || !recording) {
    return;
  }
  recording.commits += 1;
  recording.commitMs += actualDuration;
  recording.maxCommitMs = Math.max(recording.maxCommitMs, actualDuration);
}

const round = (value: number) => Math.round(value * 100) / 100;

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
}

// Samples the JS thread once per animation frame. A starved JS thread shows up
// as long gaps between frames; this does not see UI-thread hitches (use
// Instruments' Animation Hitches for those).
export function startFrameSampler() {
  const gaps: number[] = [];
  let last = performance.now();
  let handle = requestAnimationFrame(function tick() {
    const now = performance.now();
    gaps.push(now - last);
    last = now;
    handle = requestAnimationFrame(tick);
  });

  return () => {
    cancelAnimationFrame(handle);
    const sorted = [...gaps].sort((a, b) => a - b);
    const totalMs = gaps.reduce((sum, gap) => sum + gap, 0);
    return {
      frames: gaps.length,
      jsFps: totalMs > 0 ? round((gaps.length / totalMs) * 1000) : 0,
      p50GapMs: round(percentile(sorted, 0.5)),
      p95GapMs: round(percentile(sorted, 0.95)),
      p99GapMs: round(percentile(sorted, 0.99)),
      maxGapMs: round(sorted.at(-1) ?? 0),
      // Frames that took longer than 2 / 6 vsync intervals at 60Hz.
      jank33: gaps.filter((gap) => gap > 33.4).length,
      frozen100: gaps.filter((gap) => gap > 100).length,
    };
  };
}

export function summarizeDurations(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    avgMs: round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted.at(-1) ?? 0),
  };
}

export { round as roundMs };
