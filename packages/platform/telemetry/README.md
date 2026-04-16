# @hominem/telemetry

OpenTelemetry instrumentation for Hominem services and apps.

## Usage

### For Node.js services (API, Workers)

```typescript
import { initTelemetry } from '@hominem/telemetry/node'

const telemetry = initTelemetry({
  serviceName: 'hominem-api',
  serviceVersion: '1.0.0',
  environment: 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
})

// Shutdown gracefully
process.on('SIGTERM', async () => {
  await telemetry.shutdown()
})
```

### For Browser apps (Web)

```typescript
import { initTelemetry } from '@hominem/telemetry/browser'

initTelemetry({
  serviceName: 'hominem-web',
  serviceVersion: '1.0.0',
  environment: 'development',
  otlpEndpoint: 'http://localhost:4318'
})
```

### Manual instrumentation

```typescript
import { trace, metrics } from '@opentelemetry/api'

const tracer = trace.getTracer('my-component')
const meter = metrics.getMeter('my-component')

// Create a span
await tracer.startActiveSpan('process-payment', async (span) => {
  try {
    span.setAttribute('payment.id', paymentId)
    await processPayment(paymentId)
    span.setStatus({ code: SpanStatusCode.OK })
  } catch (error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR })
    throw error
  } finally {
    span.end()
  }
})

// Create a counter
const requestCounter = meter.createCounter('requests.total')
requestCounter.add(1, { route: '/api/users' })
```

## Configuration

The standard `OTEL_*` and `SENTRY_DSN` variables are documented in the env examples:

- [../../../.env.example](../../../.env.example) for shared local defaults
- [../../../services/api/.env.example](../../../services/api/.env.example) for API-local overrides
- [../../../apps/web/.env.example](../../../apps/web/.env.example) for web-only flags
- [../../../foundation/railway/env-templates/.env.preview.example](../../../foundation/railway/env-templates/.env.preview.example) and [../../../foundation/railway/env-templates/.env.production.example](../../../foundation/railway/env-templates/.env.production.example) for deployed Railway environments

Keep those files as the source of truth for variable shape and example values.

## Exports

- `@hominem/telemetry` - Shared utilities and types
- `@hominem/telemetry/node` - Node.js SDK initialization
- `@hominem/telemetry/browser` - Browser SDK initialization
- `@hominem/telemetry/shared` - Platform-agnostic utilities
