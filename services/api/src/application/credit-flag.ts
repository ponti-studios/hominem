/**
 * The PostHog side of the credit flag: is top-up switched on for this person? PostHog is asked only
 * in `test` mode (see `personInCreditMode`), the answer is kept for a short while so the budget
 * read does not call out every time, and any failure counts as "off" because the flag guards money.
 */

/** The flag's key in PostHog. */
export const CREDIT_FLAG = 'thames-top-up';

/** The one PostHog call this needs, so a test can stand in for the real client. */
export interface FlagClient {
  isFeatureEnabled(
    key: string,
    distinctId: string,
    options: { personProperties: Record<string, string>; sendFeatureFlagEvents: boolean },
  ): Promise<boolean | undefined>;
}

export interface CreditFlagDeps {
  /** Null when PostHog is not configured: nobody is let in by the flag. */
  client: FlagClient | null;
  now?: () => number;
  /** How long an answer is kept, and how long a failed lookup is remembered. */
  ttlMs?: number;
  failureTtlMs?: number;
  timeoutMs?: number;
  log?: (event: string, fields: Record<string, unknown>) => void;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_FAILURE_TTL_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 1_500;

/** Builds the lookup. The person is identified by their opaque id; the email only lets PostHog target them. */
export function createCreditFlag(
  deps: CreditFlagDeps,
): (user: { id: string; email: string }) => Promise<boolean> {
  const now = deps.now ?? Date.now;
  const kept = new Map<string, { on: boolean; until: number }>();

  return async (user) => {
    if (!deps.client) return false;
    const hit = kept.get(user.id);
    if (hit && hit.until > now()) return hit.on;

    const client = deps.client;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const answer = await Promise.race([
        client.isFeatureEnabled(CREDIT_FLAG, user.id, {
          personProperties: { email: user.email },
          // Looking a flag up should not itself become an analytics event.
          sendFeatureFlagEvents: false,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('flag lookup timed out')),
            deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          );
        }),
      ]);
      // The SDK resolves to undefined, not an error, when it could not evaluate (a network error or a
      // non-success reply). That is a failed lookup, not a conclusive "off".
      if (answer === undefined) throw new Error('flag could not be evaluated');
      const on = answer === true;
      kept.set(user.id, { on, until: now() + (deps.ttlMs ?? DEFAULT_TTL_MS) });
      return on;
    } catch (error) {
      deps.log?.('credit_flag_lookup_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      kept.set(user.id, {
        on: false,
        until: now() + (deps.failureTtlMs ?? DEFAULT_FAILURE_TTL_MS),
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
