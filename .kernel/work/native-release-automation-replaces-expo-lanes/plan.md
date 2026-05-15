# Implementation Plan

## Goal

Native release automation replaces Expo release lanes

## Approach

Prepare the native release path during late 6.2, then promote it to the authoritative production path only after rollout proof and cutover approval are complete. Keep rollback options explicit until the retirement work item closes and the observation window has passed.

## Key Decisions

| Decision          | Choice                                                                                     | Rationale                                | Alternative Considered                                                  |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------- |
| Release authority | Native release automation becomes the authoritative production path before Expo retirement | Prevents operational gaps during cutover | Retiring Expo first, rejected because it removes the fallback too early |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm the exact production support obligations moving from Expo to native

### 2. Implement the core path

- Replace Expo release obligations with native release automation and support processes
- Verify production-readiness of the new path

### 3. Verify behavior with tests

- Exercise release automation and production support flows
- Review rollback readiness before closure

### 4. Capture follow-up work

- Record documentation, ownership-transfer, and observation-window updates required to retire Expo completely

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                  |
| -------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| The release path changes but support ownership remains unclear       | Med        | High   | Tie release-path changes to explicit support responsibilities during review |
| Native release automation works technically but leaves rollback gaps | Med        | High   | Preserve fallback and rollback awareness until retirement is complete       |

## Validation

How to verify this work is correct:

- **Automated:** exercise native release automation where feasible
- **Manual:** review production support readiness and rollback viability
- **Regression:** rollout evidence and rollback paths must remain valid

## Rollback

Return production release authority to the prior Expo path until native release automation is fully ready.
