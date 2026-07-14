type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  owner_userid?: string;
  requestId?: string;
  [key: string]: unknown;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    value: error,
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatMessage(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const base = {
      timestamp,
      level,
      message,
      environment: process.env.NODE_ENV,
    };

    if (context) {
      return { ...base, ...context };
    }

    return base;
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(JSON.stringify(this.formatMessage('debug', message, context)));
    }
  }

  info(message: string, context?: LogContext) {
    console.info(JSON.stringify(this.formatMessage('info', message, context)));
  }

  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify(this.formatMessage('warn', message, context)));
  }

  error(message: string, error?: unknown, context?: LogContext) {
    const errorContext = error
      ? {
          error: serializeError(error),
          ...context,
        }
      : context;

    console.error(JSON.stringify(this.formatMessage('error', message, errorContext)));
  }
}

export const logger = new Logger();
