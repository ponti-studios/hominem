# Observability

Hominem uses three production observability surfaces with different jobs:

- New Relic is the searchable home for privacy-filtered API and worker
  application logs.
- Railway is the source of truth for complete container stdout/stderr, build,
  HTTP edge, Redis, and database logs.
- Sentry is the source of truth for application errors, OpenTelemetry traces,
  trace-derived dashboards, and alerts.

Do not use Sentry as a live stdout log tail. Do not put OTLP credentials in the
Web bundle.

## Production logs and Sentry navigation

Pulling live logs, navigating Sentry, and the incident response procedure are
runbook steps — see the `hominem-observability` skill
(`.agents/skills/hominem-observability/`) for the exact commands and
navigation path.

The API and worker send traces to Sentry and searchable application logs to
New Relic. Configure these Railway variables on both services:

- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS` (Sentry OTLP headers)
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` (New Relic EU OTLP logs endpoint)
- `OTEL_EXPORTER_OTLP_LOGS_HEADERS` (`api-key` header with the New Relic license
  key; store it as a write-only Railway secret)
- `OTEL_TRACES_SAMPLER_ARG`
- `SENTRY_DSN`

New Relic's EU endpoint is
`https://otlp.eu01.nr-data.net:4318/v1/logs`. The log-specific variables keep
the log destination independent from the trace exporter. When a log-specific
endpoint is absent, the generic endpoint and header variables remain the
fallback for local development.

General root traces should normally use a 10% ratio. Speech traces are sampled
at 100% because the speech funnel is latency-sensitive and currently small.
Check the `telemetry_initialized` log after every deployment; it reports the
effective ratio.

## Instrumentation contract

Telemetry must remain bounded and privacy-safe. Never record prompts, model
outputs, message contents, email addresses, user IDs, message IDs, generation
IDs, provider URLs, authorization data, or provider error bodies in OTEL
attributes or exported log bodies.

### Speech lifecycle

The expected lifecycle is:

```text
chat.speech
  ├─ provider response / first audio byte
  ├─ browser speech.playback
  └─ speech.reconciliation.lookup
       └─ usage event with tokens and cost
```

Useful bounded attributes include `speech.feature`, `speech.character_count`,
`speech.provider_wait_ms`, `speech.time_to_first_audio_byte_ms`,
`speech.request_to_first_playable_ms`, `speech.stream_duration_ms`,
`speech.session_duration_ms`, `speech.audio_bytes`, `speech.outcome`,
`speech.usage_available`, `speech.total_tokens`, reconciliation attempt, and
reconciliation outcome.

The browser sends one terminal playback event through the authenticated API
proxy. The API converts it into a `speech.playback` span.

### Application logs exported to New Relic

Every event emitted through the shared Hominem logger is sent to New Relic.
Messages use stable event names; unstructured message text is replaced with a
generic event name. Attributes remain explicitly allowlisted to bounded
operational scalars such as HTTP method/path/status, queue, duration, outcome,
and error type. Paths have query strings and ID-like segments removed. Prompts,
model outputs, message contents, email addresses, user IDs, request IDs, message
IDs, generation IDs, provider URLs, authorization data, and provider error
bodies are not exported. Error messages, stacks, job IDs, and arbitrary payload
objects are omitted.

Railway continues to capture the complete stdout/stderr stream, including logs
written directly by dependencies. New Relic receives events emitted through
Hominem's shared logger; it is not a raw Railway log drain. Railway does not
provide a native log drain, so platform HTTP/build logs and direct dependency
stdout remain searchable in Railway.

## Operational error logging contract

Every request-level failure must be diagnosable from one bounded record and one
correlation key. API request middleware assigns an `x-request-id`, includes it
in request start/completion logs, and attaches it to the HTTP span. Route or
shared-handler code must log the original error before converting it into a
client response; otherwise a generic 4xx response can bypass the global Hono
error handler, which is what happened for chat planning failures.

Error records should include:

- a stable event name and bounded failure category;
- HTTP method, route/path, status, and request ID;
- service/component and operation stage (for example `chat_tool_planning`);
- model/provider metadata when relevant, without provider request URLs or raw
  response bodies;
- retryability and whether any side effect was committed.

Do not use the final HTTP status as the failure category. Distinguish client
input, unsupported capability, planner validation, provider, runtime/tool,
storage, and cancellation failures. Preserve the user-facing message in the
API response, but keep diagnostic context in the server log and Sentry event.

The current audit found three recurring sources of poor diagnosis: some shared
HTTP handlers catch errors internally, request IDs were not present on the
general HTTP log/span path, and several call sites log arbitrary provider or
database errors directly. New instrumentation should use bounded error
metadata and should not add prompts, model output, personal identifiers,
message/generation IDs, or provider error bodies to exported telemetry.

## Dashboards and alerts

Alert ownership points to the API/service owner. Do not change provider or
deployment configuration based on a dashboard aggregate alone. The panel list
and recommended alert thresholds to set up are in the `hominem-observability`
skill (`.agents/skills/hominem-observability/`).

## Analytics backlog

### Completed in this observability pass

- Railway log wrapper with API, worker, Redis, and database aliases.
- Explicit production log/runbook documentation.
- Active HTTP span context so child AI and speech spans correlate with the
  originating request.
- Safe OTEL export of every shared-logger event to New Relic, with bounded
  attributes and path redaction.
- Speech reconciliation spans and bounded outcome/usage attributes.
- Speech queue startup, completion, stall, failure, and pending snapshot signals.
- Browser playback funnel and privacy constraints.
- Usage reconciliation health and missing-generation-ID visibility.

### Next product analytics work

- Add a bounded usage-page view/fetch/error event so empty, delayed, and failed
  usage reports can be distinguished from genuinely zero usage.
- Add feature adoption counts by feature, model family, voice, and response
  length, using coarse labels rather than raw request text.
- Add a chat funnel from message submitted → model stream started → first token
  → stream completed/failed → optional speech requested → playback completed.
- Add cost-per-successful-action and cost-per-user-session aggregates from the
  existing usage tables; keep raw billing data in PostgreSQL rather than Sentry.
- Add daily retention and repeat-use cohorts for chat speech and other AI
  features using the product analytics warehouse.
- Add a provider comparison dimension once more than one provider/model is
  active; do not expose provider generation IDs.

## Local and post-deploy verification

Run the `hominem-observability` skill's local verification loop
(foundation stack + Jaeger) and post-deploy check (confirm one
`speech.playback` span, one `chat.speech` trace, and a `succeeded`
reconciliation run) — see `.agents/skills/hominem-observability/`.
