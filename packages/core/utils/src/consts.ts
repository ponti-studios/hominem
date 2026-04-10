/**
 * Shared constants for the Hominem application
 * Use this file to define values that need to be consistent across the monorepo
 */

/**
 * BullMQ Queue Names
 * These constants ensure that queue names are consistent across the monorepo
 */
export const QUEUE_NAMES = {
  /**
   * Queue for transaction import jobs
   * Used by:
   * - apps/api/src/routes/finance.router.ts (adding jobs)
   * - background processors (processing jobs)
   */
  IMPORT_TRANSACTIONS: 'import-transaction',

  /**
   * Queue for Plaid synchronization jobs
   * Used by:
   * - apps/api/src/routes/plaid.router.ts (adding jobs)
   * - background processors (processing jobs)
   */
  PLAID_SYNC: 'plaid-sync',
  /**
   * Queue for Google Calendar synchronization jobs
   * Used by:
   * - apps/api/src/rpc/routers/events.ts (adding jobs)
   * - background processors (processing jobs)
   */
  GOOGLE_CALENDAR_SYNC: 'google-calendar-sync',
  /**
   * Queue for place photo enrichment jobs
   * Used by:
   * - apps/api (enqueuing jobs)
   * - background processors (processing jobs)
   */
  PLACE_PHOTO_ENRICH: 'place-photo-enrich',

  /**
   * Queue for file processing jobs
   * Used by:
   * - services/api/src/rpc/routes/files.ts (adding jobs)
   * - services/api/src/workers/file-processing.ts (processing jobs)
   */
  FILE_PROCESSING: 'file-processing',
} as const;

/**
 * Redis Channel Names
 * These constants ensure that pub/sub channel names are consistent
 */
export const REDIS_CHANNELS = {
  /**
   * Channel for import progress updates
   * Used by:
   * - background processors (publishing)
   * - apps/api/src/websocket/index.ts (subscribing)
   */
  IMPORT_PROGRESS: 'import:progress',
  SUBSCRIBE: 'import:subscribe',
  SUBSCRIBED: 'import:subscribed',
} as const;
