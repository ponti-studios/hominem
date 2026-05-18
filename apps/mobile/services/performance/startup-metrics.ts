import { posthog } from '~/services/posthog';

type StartupPhase =
  | 'app_start'
  | 'root_layout_mounted'
  | 'shell_ready'
  | 'auth_boot_start'
  | 'auth_boot_resolved'
  | 'local_auth_restored'
  | 'workspace_screen_ready';

type WorkspaceTarget = 'feed' | 'note' | 'chat';
type WorkspaceRestoreSource = 'default_feed' | 'last_open_route';
type AuthRestoreSource = 'local' | 'network' | 'none';
type AuthValidationOutcome = 'loaded' | 'signed_out' | 'degraded' | 'background_failed';

interface StartupMetric {
  phase: StartupPhase;
  atMs: number;
}

const phaseTimes = new Map<StartupPhase, number>();
let hasCapturedStartupTelemetry = false;

const startupContext: {
  authRestoreSource: AuthRestoreSource | null;
  authValidationOutcome: AuthValidationOutcome | null;
  workspaceTarget: WorkspaceTarget | null;
  workspaceRestoreSource: WorkspaceRestoreSource | null;
  inboxCacheHit: boolean | null;
  inboxItemCount: number | null;
} = {
  authRestoreSource: null,
  authValidationOutcome: null,
  workspaceTarget: null,
  workspaceRestoreSource: null,
  inboxCacheHit: null,
  inboxItemCount: null,
};

function getDurationMs(start: StartupPhase, end: StartupPhase): number | null {
  const startTime = phaseTimes.get(start);
  const endTime = phaseTimes.get(end);

  if (startTime === undefined || endTime === undefined) {
    return null;
  }

  return endTime - startTime;
}

export function markStartupPhase(phase: StartupPhase, nowMs: number = Date.now()): StartupMetric {
  phaseTimes.set(phase, nowMs);
  return { phase, atMs: nowMs };
}

export function updateStartupContext(nextContext: Partial<typeof startupContext>) {
  Object.assign(startupContext, nextContext);
}

export function recordWorkspaceScreenReady(input: {
  target: WorkspaceTarget;
  restoreSource: WorkspaceRestoreSource;
}) {
  updateStartupContext({
    workspaceTarget: input.target,
    workspaceRestoreSource: input.restoreSource,
  });

  markStartupPhase('workspace_screen_ready');

  if (hasCapturedStartupTelemetry) {
    return;
  }

  hasCapturedStartupTelemetry = true;

  posthog.capture('app_startup_timing', {
    appStartToRootLayoutMs: getDurationMs('app_start', 'root_layout_mounted'),
    appStartToShellReadyMs: getDurationMs('app_start', 'shell_ready'),
    appStartToWorkspaceReadyMs: getDurationMs('app_start', 'workspace_screen_ready'),
    authBootDurationMs: getDurationMs('auth_boot_start', 'auth_boot_resolved'),
    authRestoreLatencyMs: getDurationMs('auth_boot_start', 'local_auth_restored'),
    inboxCacheHit: startupContext.inboxCacheHit,
    inboxItemCount: startupContext.inboxItemCount,
    authRestoreSource: startupContext.authRestoreSource,
    authValidationOutcome: startupContext.authValidationOutcome,
    workspaceTarget: startupContext.workspaceTarget,
    workspaceRestoreSource: startupContext.workspaceRestoreSource,
  });
}
