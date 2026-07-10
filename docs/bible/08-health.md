# Health

## Purpose

Capture personal health observations and activity without presenting Hominem as a diagnostic or clinical-record system.

## Canonical entities and relationships

`app.health_observations` are typed, timestamped readings with a value and unit. `app.health_activities` are timed exercise/activity events with a `jsonb` metrics blob.

## Lifecycle and invariants

Observed facts are immutable; `health_observations.supersedes_id` links a correction to the reading it replaces rather than editing in place. Units are explicit per observation.

## Privacy, provenance, and AI evidence

Health is highly sensitive and excluded from external AI by default. Any future answer includes source, observation time, unit, and confidence and cannot make diagnoses or treatment recommendations.

## Rejected models

- A single untyped health JSON table.
- Clinical diagnosis or medical-advice features.
- Converting units without preserving original values.

## Divergence from the original design

This domain is much thinner in production than the original design: `health_sources` (as a distinct table — production instead stores `source` as free text on each observation/activity), `sleep_sessions`, `nutrition_entries`, `medications`, and `supplement_regimens` are all **not implemented**. Only observations and activities exist. This is a real capability gap, not a naming difference — sleep, nutrition, and medication tracking are unbuilt scope.

## Implementation readiness

- [ ] Health repositories expose observations and activities with source, timestamp, unit, and confidence.
- [ ] Services preserve original units and avoid diagnostic or treatment logic.
- [ ] API DTOs keep health disabled from broad external surfaces by default.
- [ ] MCP health access remains deferred until explicit consent and safety rules exist.
- [ ] Tests cover unit preservation, time windows, source filtering, sensitivity gating, and no-diagnosis response behavior.
- [ ] Deferred: sleep, nutrition, medications, supplements, and first-class health-source records.

## Open questions

None.
