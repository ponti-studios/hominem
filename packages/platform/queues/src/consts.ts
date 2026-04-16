export const QUEUE_NAMES = {
  IMPORT_TRANSACTIONS: 'import-transaction',
  GOOGLE_CALENDAR_SYNC: 'google-calendar-sync',
  PLACE_PHOTO_ENRICH: 'place-photo-enrich',
  FILE_PROCESSING: 'file-processing',
} as const;

export const REDIS_CHANNELS = {
  IMPORT_PROGRESS: 'import:progress',
  SUBSCRIBE: 'import:subscribe',
  SUBSCRIBED: 'import:subscribed',
} as const;
