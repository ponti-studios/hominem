# Feature Specification: Health

**Feature Branch**: `08-health`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Capture personal health observations and activity without presenting Hominem as a diagnostic or clinical-record system.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Health Observations with Units (Priority: P1)

As a user, I want to record typed, timestamped health observations with explicit units so that I can track measurements (weight, blood pressure, heart rate, etc.) without losing unit context.

**Why this priority**: Observations are the core health entity — typed readings with units are the foundation.

**Independent Test**: A health observation with a value and explicit unit can be recorded; querying returns the original value and unit.

**Acceptance Scenarios**:

1. **Given** a user records a weight observation of 70 kg, **When** queried, **Then** the value `70` and unit `kg` are returned.
2. **Given** a health observation with a timestamp, **When** queried within a time window, **Then** only observations in that window are returned.

### User Story 2 - Immutable Observations with Corrections (Priority: P1)

As a user, I want to correct a past observation without losing the original reading so that my health history is auditable.

**Why this priority**: Immutability is critical for health data integrity.

**Independent Test**: A corrected observation links to the original via `supersedes_id`; the original remains in the database.

**Acceptance Scenarios**:

1. **Given** a health observation exists, **When** a correction is created with `supersedes_id` pointing to the original, **Then** both records exist and the correction references the original.
2. **Given** an observation that was superseded, **When** queried by default, **Then** the latest (non-superseded) observation is returned.

### User Story 3 - Health Activities (Priority: P2)

As a user, I want to record timed exercise/activity events with metrics so that I can track workouts and physical activity.

**Why this priority**: Activities complement observations for a complete health picture.

**Independent Test**: A health activity with a `jsonb` metrics blob can be created and queried by time range.

**Acceptance Scenarios**:

1. **Given** a health activity with a timestamp and metrics, **When** queried, **Then** the activity and its metrics are returned.
2. **Given** activities recorded over several days, **When** queried with a date range, **Then** only activities in that range are returned.

### Edge Cases

- What happens when a user records an observation in pounds but usually uses kilograms — is the original unit preserved?
- How does the system handle observations that imply a medical diagnosis?
- What happens when a superseding correction has a different unit than the original?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.health_observations` MUST be typed, timestamped readings with explicit value and unit.
- **FR-002**: Observations MUST be immutable — corrections MUST use `supersedes_id` to link to the replaced reading.
- **FR-003**: Units MUST be explicit per observation — conversion must preserve original values.
- **FR-004**: `app.health_activities` MUST be timed exercise/activity events with a `jsonb` metrics blob.
- **FR-005**: Health data MUST be classified as highly sensitive and excluded from external AI by default.
- **FR-006**: Any future AI answer MUST include source, observation time, unit, and confidence and MUST NOT make diagnoses or treatment recommendations.
- **FR-007**: MCP health access MUST remain deferred until explicit consent and safety rules exist.
- **FR-008**: Tests MUST cover unit preservation, time windows, source filtering, sensitivity gating, and no-diagnosis response behavior.

### Key Entities

- **app.health_observations**: Typed, timestamped readings with value, unit, and optional `supersedes_id`.
- **app.health_activities**: Timed exercise/activity events with `jsonb` metrics blob.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Health repositories expose observations and activities with source, timestamp, unit, and confidence.
- **SC-002**: Services preserve original units and avoid diagnostic or treatment logic.
- **SC-003**: API DTOs keep health disabled from broad external surfaces by default.
- **SC-004**: MCP health access remains deferred until explicit consent and safety rules exist.
- **SC-005**: Tests cover unit preservation, time windows, source filtering, sensitivity gating, and no-diagnosis response behavior.

## Assumptions

- This domain is much thinner in production than the original design — `health_sources`, `sleep_sessions`, `nutrition_entries`, `medications`, and `supplement_regimens` are all not implemented.
- Only observations and activities exist — sleep, nutrition, and medication tracking are unbuilt scope.
- Source is stored as free text on each observation/activity, not as a distinct `health_sources` table.
- Hominem is not a diagnostic or clinical-record system — the model explicitly rejects clinical features.
- Health is highly sensitive — no external MCP tool in v1.
