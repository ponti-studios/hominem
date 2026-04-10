type StartupPhase =
  | 'app_start'
  | 'root_layout_mounted'
  | 'shell_ready'
  | 'auth_boot_start'
  | 'auth_boot_resolved';

interface StartupMetric {
  phase: StartupPhase;
  atMs: number;
}

const phaseTimes = new Map<StartupPhase, number>();

export function markStartupPhase(phase: StartupPhase, nowMs: number = Date.now()): StartupMetric {
  phaseTimes.set(phase, nowMs);
  return { phase, atMs: nowMs };
}
