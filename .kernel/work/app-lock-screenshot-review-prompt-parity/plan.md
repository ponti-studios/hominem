# Implementation Plan

## Goal

App lock, screenshot prevention, and review prompt parity

## Approach

Implement each settings-driven control as an end-to-end behavior rather than as an isolated native hook. Verify toggles and runtime effects together, and record lifecycle assumptions so the telemetry work can proceed in parallel on the same foundations.

## Key Decisions

| Decision           | Choice                                                     | Rationale                                          | Alternative Considered                                                               |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Verification model | Settings toggle and runtime behavior are verified together | Prevents false confidence from surface-only parity | Validating settings UI alone, rejected because runtime behavior is the real contract |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm app-lock, screenshot, and review-prompt behaviors to preserve

### 2. Implement the core path

- Build runtime app-lock and screenshot-prevention behavior
- Recreate review-prompt behavior tied to the current app logic

### 3. Verify behavior with tests

- Test preference and runtime-state behavior where feasible
- Verify controls on device from settings through runtime effect

### 4. Capture follow-up work

- Record lifecycle hooks and settings assumptions the telemetry work item must account for

## Risks

| Risk                                                         | Likelihood | Impact | Mitigation                                                 |
| ------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------- |
| Settings controls appear enabled without real runtime effect | Med        | High   | Validate each control end to end on device                 |
| Review-prompt timing is difficult to compare with Expo       | Med        | Med    | Anchor behavior to the existing prompt rules during review |

## Validation

How to verify this work is correct:

- **Automated:** targeted preference and runtime-state tests where feasible
- **Manual:** toggle settings and verify app-lock, screenshot, and review-prompt behavior on device
- **Regression:** core settings surfaces must remain stable

## Rollback

Disable native device controls and keep settings limited to surface parity until runtime behavior is corrected.
