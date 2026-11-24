import { logger } from '@hominem/telemetry';

import { env } from '../env';
import { runScheduledPass } from './proactivity-schedule.service';

const TICK_MS = 15 * 60_000;

/**
 * Runs the scheduled proactivity pass once a day, during the configured UTC
 * hour. The sweep is off unless `PROACTIVITY_SCHEDULED_PASS_HOUR` is set: the
 * product cadence is still an open decision, so nothing runs by default.
 */
export function startProactivityScheduler(): () => void {
  const hour = env.PROACTIVITY_SCHEDULED_PASS_HOUR;
  if (hour === undefined) return () => undefined;

  let running = false;
  const tick = async () => {
    if (running || new Date().getUTCHours() !== hour) return;
    running = true;
    try {
      const result = await runScheduledPass({ now: new Date() });
      if (result.owners > 0) logger.info('proactivity_scheduled_pass', result);
    } catch (error) {
      logger.error('proactivity_scheduled_pass_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(tick, TICK_MS);
  return () => clearInterval(timer);
}
