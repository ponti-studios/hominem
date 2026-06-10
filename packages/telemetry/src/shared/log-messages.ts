export const LOG_MESSAGES = {
  HTTP_REQUEST_IN: 'http_request_in',
  HTTP_REQUEST_OUT: 'http_request_out',
  SERVER_STARTED: 'server_started',
  SERVER_SHUTDOWN: 'server_shutdown',
  ROUTE_NOT_FOUND: 'route_not_found',
  HEALTH_CHECK_FAILED: 'health_check_failed',
  TELEMETRY_SHUTDOWN_FAILED: 'telemetry_shutdown_failed',
  TELEMETRY_INIT_FAILED: 'telemetry_init_failed',
  VOICE_EVENT: 'voice_event',
  FILE_PROCESS_ERROR: 'file_process_error',
  IMAGE_ANALYZE_ERROR: 'image_analyze_error',
  DOCUMENT_SUMMARIZE_ERROR: 'document_summarize_error',
  DOCUMENT_PROCESS_ERROR: 'document_process_error',
  DATABASE_HEALTH_CHECK_FAILED: 'database_health_check_failed',
  INVALID_ENV_VARIABLES: 'invalid_env_variables',
  LOCAL_STORE_VALIDATION_FAILED: 'local_store_validation_failed',
  INTENT_DONATION_FAILED: 'intent_donation_failed',
} as const;

export type LogMessage = (typeof LOG_MESSAGES)[keyof typeof LOG_MESSAGES];
