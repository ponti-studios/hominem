import { logger } from './logger.js';

type TelemetryConfig = {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint?: string;
  otlpProtocol?: string;
  samplingRatio?: number;
};

export function initTelemetry(config: TelemetryConfig) {
  logger.info('telemetry_initialized', {
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    environment: config.environment,
    otlpEnabled: Boolean(config.otlpEndpoint),
    otlpProtocol: config.otlpProtocol,
    samplingRatio: config.samplingRatio,
  });

  return {
    shutdown: () => Promise.resolve(),
  };
}
