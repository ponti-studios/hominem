# Implementation Plan

## Goal

Internal and staged external parallel run

## Approach

Execute rollout in staged cohorts against the already-defined gates and review cadence. Treat evidence collection and rollback readiness as active parts of the work, not as passive monitoring.

## Key Decisions

| Decision     | Choice                                 | Rationale                                     | Alternative Considered                                              |
| ------------ | -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Rollout mode | Staged dual-run against explicit gates | Produces controlled, decision-useful evidence | Unstructured soak, rejected because it weakens the cutover decision |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm cohorts, review cadence, and signals required for the dual run

### 2. Implement the core path

- Execute internal and staged external rollout phases
- Collect and review evidence against the agreed gates

### 3. Verify behavior with tests

- Use existing test suites and telemetry as rollout checks
- Review observed behavior and rollback triggers continuously

### 4. Capture follow-up work

- Record the final evidence and cutover recommendation that the next milestone will consume

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                      |
| -------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| Evidence collection is incomplete or too noisy to support a decision | Med        | High   | Keep the cohort plan and review cadence explicit from the start |
| Rollback readiness degrades during rollout                           | Med        | High   | Rehearse and preserve rollback steps throughout the dual run    |

## Validation

How to verify this work is correct:

- **Automated:** rollout relies on previously-built suites and telemetry gates
- **Manual:** review dual-run evidence against the agreed thresholds and rollback criteria
- **Regression:** the rollback path must remain viable until cutover is approved

## Rollback

Return traffic and support emphasis to Expo according to the agreed rollback runbooks until rollout blockers are resolved.
