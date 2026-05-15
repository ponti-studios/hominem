import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.fn();

vi.mock('~/services/posthog', () => ({
  posthog: {
    capture,
  },
}));

describe('startup metrics', () => {
  beforeEach(async () => {
    capture.mockReset();
    vi.resetModules();
  });

  it('captures startup telemetry once with accumulated context', async () => {
    const metrics = await import('~/services/performance/startup-metrics');

    metrics.markStartupPhase('app_start', 100);
    metrics.markStartupPhase('root_layout_mounted', 130);
    metrics.markStartupPhase('auth_boot_start', 140);
    metrics.markStartupPhase('local_auth_restored', 170);
    metrics.markStartupPhase('auth_boot_resolved', 240);
    metrics.markStartupPhase('shell_ready', 250);
    metrics.updateStartupContext({
      authRestoreSource: 'local',
      authValidationOutcome: 'loaded',
      inboxCacheHit: true,
      inboxItemCount: 12,
    });

    metrics.recordWorkspaceScreenReady({
      target: 'chat',
      restoreSource: 'last_open_route',
    });

    metrics.recordWorkspaceScreenReady({
      target: 'feed',
      restoreSource: 'default_feed',
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      'app_startup_timing',
      expect.objectContaining({
        appStartToRootLayoutMs: 30,
        authBootDurationMs: 100,
        authRestoreLatencyMs: 30,
        authRestoreSource: 'local',
        authValidationOutcome: 'loaded',
        inboxCacheHit: true,
        inboxItemCount: 12,
        workspaceTarget: 'chat',
        workspaceRestoreSource: 'last_open_route',
      }),
    );
  });
});
