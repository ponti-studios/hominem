/**
 * Tells a person's open Thames app that their credit changed, over server-sent events.
 *
 * A settled payment fires Postgres `NOTIFY`; every API instance listens and hands the event to the
 * connections it holds, so it works the same with one instance or two (as in a rolling deploy). The
 * event only says "read your credit again": the ledger stays the truth, so a lost event is late, not
 * wrong. Nothing here is telemetry and the payload carries no card or payment details.
 */
import { pool } from '@hominem/db/core';
import { logger } from '@hominem/telemetry';
import pg from 'pg';
import { z } from 'zod';

export const CREDIT_EVENTS_CHANNEL = 'credit_events';

/** What happened: money was added, or a payment was refused as not UK and nothing was charged. */
export type CreditEventOutcome = 'credited' | 'not_charged';

const payloadSchema = z.object({
  userId: z.string().min(1),
  outcome: z.enum(['credited', 'not_charged']),
});

type Listener = (outcome: CreditEventOutcome) => void;

const listeners = new Map<string, Set<Listener>>();

/** Calls `listener` for each event about this person until the returned function is called. */
export function subscribeCreditEvents(userId: string, listener: Listener): () => void {
  const forUser = listeners.get(userId) ?? new Set<Listener>();
  forUser.add(listener);
  listeners.set(userId, forUser);
  return () => {
    forUser.delete(listener);
    if (forUser.size === 0) listeners.delete(userId);
  };
}

/** Hands one notification to this instance's connections. Exported for the listener and the tests. */
export function deliverCreditNotification(payload: string | undefined): void {
  if (!payload) return;
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    logger.warn('credit_event_payload_malformed', {});
    return;
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    logger.warn('credit_event_payload_malformed', {});
    return;
  }
  for (const listener of listeners.get(parsed.data.userId) ?? []) listener(parsed.data.outcome);
}

/** Tells every instance that this person's credit changed. */
export async function publishCreditEvent(
  userId: string,
  outcome: CreditEventOutcome,
): Promise<void> {
  const payload = JSON.stringify({ userId, outcome });
  await pool.query('select pg_notify($1, $2)', [CREDIT_EVENTS_CHANNEL, payload]);
}

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

let client: pg.Client | null = null;
let closed = true;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// A pooled connection cannot hold LISTEN safely, so this keeps one of its own and listens again
// after a drop, because Postgres forgets LISTEN when a connection ends.
async function connect(): Promise<void> {
  if (closed) return;
  const next = new pg.Client({ connectionString: pool.options.connectionString });
  client = next;
  next.on('notification', (message) => deliverCreditNotification(message.payload));
  next.on('error', (error) => {
    logger.warn('credit_events_connection_error', { error: error.message });
  });
  next.on('end', () => {
    if (closed || client !== next) return;
    scheduleReconnect();
  });
  try {
    await next.connect();
    await next.query(`LISTEN ${CREDIT_EVENTS_CHANNEL}`);
    reconnectAttempt = 0;
    logger.info('credit_events_listener_connected');
  } catch (error) {
    logger.warn('credit_events_listener_connect_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (client === next) scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (closed || reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt, RECONNECT_MAX_DELAY_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay);
}

export function startCreditEvents(): void {
  closed = false;
  reconnectAttempt = 0;
  void connect();
}

export async function stopCreditEvents(): Promise<void> {
  closed = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  await client?.end().catch(() => undefined);
  client = null;
}
