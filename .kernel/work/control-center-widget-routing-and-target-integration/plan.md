# Implementation Plan

## Goal

Control Center widget routing and target integration parity

## Approach

Build widget routing on the already-defined system-entry contract, then verify target configuration and variant behavior explicitly. Target wiring can begin once the shared contract is drafted, but sign-off requires that contract and all required variants to be stable together.

## Key Decisions

| Decision        | Choice                                                                    | Rationale                           | Alternative Considered                                                              |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Widget contract | Widget uses the same shared-data and destination contract as the main app | Minimizes drift across entry points | Widget-specific routing rules, rejected because they would fragment system behavior |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm widget routing, target wiring, and variant behaviors that must match current expectations

### 2. Implement the core path

- Build widget routing into the native destination contract
- Recreate target wiring and variant-safe integration behavior

### 3. Verify behavior with tests

- Test shared routing and target helpers where feasible
- Verify widget behavior and target integration on device across required variants

### 4. Capture follow-up work

- Record rollout validation needs for widget and extension surfaces in Phase 6

## Risks

| Risk                                                           | Likelihood | Impact | Mitigation                                                           |
| -------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Widget routes correctly in one variant but not another         | Med        | High   | Verify every required variant and target combination explicitly      |
| Extension-target assumptions drift from the app-group contract | Med        | High   | Keep the shared-data contract explicit and review it during sign-off |

## Validation

How to verify this work is correct:

- **Automated:** routing and target helper tests where feasible
- **Manual:** verify widget interaction and destination routing on device across required variants
- **Regression:** app-intent and shortcut behavior must remain stable

## Rollback

Disable widget-specific routing and limit Apple integration to the core app until target and parity issues are corrected.
