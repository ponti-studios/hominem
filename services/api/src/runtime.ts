import { initTelemetry } from '@hakumi/telemetry/node';
import { logger } from '@hakumi/utils/logger';
import * as Sentry from '@sentry/node';

import { env } from './env';

type ShutdownTask = () => Promise<void> | void;

export function initRuntime(serviceName: string) {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0,
      skipOpenTelemetrySetup: true,
    });
  }

  const telemetry = initTelemetry({
    serviceName,
    serviceVersion: process.env.npm_package_version || '0.0.0',
    environment: env.NODE_ENV || 'development',
    ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? { otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }
      : {}),
    ...(process.env.OTEL_EXPORTER_OTLP_PROTOCOL
      ? { otlpProtocol: process.env.OTEL_EXPORTER_OTLP_PROTOCOL }
      : {}),
    samplingRatio: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0'),
  });

  const installSignalHandlers = (tasks: ShutdownTask[] = []) => {
    const shutdown = async (signal: NodeJS.Signals) => {
      logger.info('server_shutdown', { serviceName, signal });
      for (const task of tasks) {
        await task();
      }
      await telemetry.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  };

  return {
    installSignalHandlers,
  };
}
