# Observability

Hominem uses two production observability surfaces with different jobs:

- New Relic is the primary home for API and worker traces, metrics, and
  privacy-filtered application logs, plus Omiro mobile errors and performance.
- Railway is the source of truth for complete container stdout/stderr, build,
  HTTP edge, Redis, and database logs.

Do not put OTLP or New Relic user API credentials in a Web or mobile bundle.

## Production logs and New Relic navigation

Pulling live logs, navigating New Relic, and the incident response procedure are
runbook steps — see the `hominem-observability` skill
(`.agents/skills/hominem-observability/`) for the exact commands and
navigation path.

The API and worker send OTLP traces, metrics, and searchable application logs
to New Relic. Configure these Railway variables on both services:

- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS` (`api-key` header with the New Relic license key;
  store it as a write-only Railway secret)
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` (New Relic EU OTLP logs endpoint)
- `OTEL_EXPORTER_OTLP_LOGS_HEADERS` (`api-key` header with the New Relic license
  key; store it as a write-only Railway secret)
- `OTEL_TRACES_SAMPLER_ARG`

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to `https://otlp.eu01.nr-data.net:4318`.
The SDK appends `/v1/traces` and `/v1/metrics`; the log-specific endpoint is
`https://otlp.eu01.nr-data.net:4318/v1/logs`. The log-specific variables keep
the log destination configurable independently. When a log-specific endpoint
is absent, the generic endpoint and headers are the fallback for local
development.

Use a 10% parent-based trace sample by default. Child spans inherit the root
decision so traces remain intact; do not force-sample selected child spans.
Metrics and structured error logs remain unsampled. Check the
`telemetry_initialized` log after every deployment for the effective ratio.

## Instrumentation contract

Telemetry must remain bounded and privacy-safe. Never record prompts, model
outputs, message contents, email addresses, user IDs, message IDs, generation
IDs, provider URLs, authorization data, or provider error bodies in OTEL
attributes or exported log bodies.

Omiro's New Relic mobile agent captures native crashes and unhandled JavaScript
errors. Unhandled JavaScript error events can include the original error
message, type, and stack; keep user data and provider response bodies out of
error messages. The React error boundary reports a generic message with a
bounded stack. Network request and response capture are disabled because
request URLs may contain record IDs; API server traces use registered route
templates instead.

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

### Chat generation lifecycle

Each sampled API generation emits a `chat.generation` span to New Relic. The span covers
generation execution through persistence and post-commit effects, with bounded
attributes for `chat.generation.kind`, `chat.generation.outcome`,
`chat.generation.duration_ms`, `chat.generation.time_to_first_token_ms`,
`chat.generation.time_to_first_tool_call_ms`, `chat.generation.tool_count`, and
prompt/output/total token counts when the provider reports usage. Generation
spans inherit the request trace sampling decision. They contain no
chat, user, message, or generation identifiers and no prompt or response text.

Use New Relic trace search and dashboards, filtered to
`deployment.environment.name:production`, for:

- p50/p95/p99 `chat.generation.duration_ms` and
  `chat.generation.time_to_first_token_ms`, grouped by kind and outcome.
- p50/p95 `chat.generation.time_to_first_tool_call_ms` for tool-using turns.
- Generation volume and committed, failed, and cancelled rates.
- Tool-call counts and provider-reported prompt, output, and total tokens.

Generation trace counts are sampled, so use metrics and the usage database for
complete volume and billing aggregates. The `http.server` span measures request
latency separately; a stream request can complete before its generation
finishes.

### Application logs exported to New Relic

Every event emitted through the shared Hominem logger is sent to New Relic.
Messages use stable event names; unstructured message text is replaced with a
generic event name. Attributes remain explicitly allowlisted to bounded
operational scalars such as HTTP method/path/status, queue, duration, outcome,
and error type. HTTP paths use registered route templates; unmatched paths use
a static label. Other path values have query strings and ID-like segments
removed. Prompts,
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

Every request-level failure must be diagnosable from one bounded error record
and a correlated trace. API request middleware assigns an `x-request-id`,
returns it to the caller, and attaches it to the HTTP span. Routine requests
are tracked through spans and metrics rather than start/completion log pairs.
Route or
shared-handler code must log the original error before converting it into a
client response; otherwise a generic 4xx response can bypass the global Hono
error handler, which is what happened for chat planning failures.

Error records should include:

- a stable event name and bounded failure category;
- HTTP method, route template, status, and trace context. Request IDs are
  available in Railway stdout and the response header, but are not exported to
  New Relic.
- service/component and operation stage (for example `chat_tool_planning`);
- model/provider metadata when relevant, without provider request URLs or raw
  response bodies;
- retryability and whether any side effect was committed.
- `failureType`, a bounded, stable identifier for the specific failure reason.
  `code` remains the broad HTTP/service category (`NOT_FOUND`,
  `VALIDATION_ERROR`, etc.); use `failureType` to distinguish cases such as
  `note.not_found`, `note.reference_unavailable`, and `chat.message.not_found`.
  Every `ServiceError` gets a category default; known resource-not-found and
  operation failures use specific values. `operation`, `failureStage`,
  `retryable`, and `sideEffectCommitted` are optional bounded dimensions that
  make failures actionable. Exported values must be added to the shared
  failure type schema and OTEL log allowlist; never derive them from error
  messages or arbitrary details.

### New Relic error triage

Start with `service.name` and `deployment.environment.name`, then narrow by
`failureType` or `log.event`. `failureCategory` groups the broad HTTP/service
class; `failureType` identifies the domain cause; `operation` and
`failureStage` identify where to investigate. `retryable` distinguishes
transient worker failures from terminal ones. Use `trace.id` to open the
correlated request waterfall when available. For API request failures, the
stable event name is `api_request_failed`; worker events use operation event
names such as `file_processing_failed` and `embedding_generation_failed`.

Do not use the final HTTP status as the failure category. Distinguish client
input, unsupported capability, planner validation, provider, runtime/tool,
storage, and cancellation failures. Preserve the user-facing message in the
API response, but keep diagnostic context in bounded New Relic error events.

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
  existing usage tables; keep raw billing data in PostgreSQL rather than telemetry.
- Add daily retention and repeat-use cohorts for chat speech and other AI
  features using the product analytics warehouse.
- Add a provider comparison dimension once more than one provider/model is
  active; do not expose provider generation IDs.

## Local and post-deploy verification

Run the `hominem-observability` skill's local verification loop
(foundation stack + Jaeger) and post-deploy check (confirm one
`speech.playback` span, one `chat.speech` trace, and a `succeeded`
reconciliation run) — see `.agents/skills/hominem-observability/`.
