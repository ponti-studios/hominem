# Implementation Plan

## Goal

Native inbox feed and refresh parity

## Approach

Build the inbox route as the first real consumer of the native data layer, then prove refresh and update behavior under daily-use conditions. Keep scroll-restoration concerns isolated to the next work item.

## Key Decisions

| Decision            | Choice                                                                    | Rationale                                            | Alternative Considered                                               |
| ------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Feed-first delivery | Route rendering and refresh behavior are proven before anchor restoration | Separates core data parity from list-behavior tuning | Combining both at once, rejected because it obscures failure sources |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm feed rendering, refresh, and navigation affordances to preserve

### 2. Implement the core path

- Build inbox route, feed rendering, and refresh behavior
- Recreate invalidation and update behavior needed by the inbox surface

### 3. Verify behavior with tests

- Test feed refresh and update behavior
- Verify inbox route behavior on device against Expo

### 4. Capture follow-up work

- Record anchor-restoration requirements and update edge cases for the next work item

## Risks

| Risk                                                             | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Feed refresh looks correct but invalidation rules drift          | Med        | High   | Validate reload and update behavior explicitly during review              |
| Data behavior is overfit to inbox and unusable by later surfaces | Med        | Med    | Keep query and invalidation rules generic enough for notes and chat reuse |

## Validation

How to verify this work is correct:

- **Automated:** inbox route and refresh behavior tests
- **Manual:** verify feed loading and refresh on device against Expo
- **Regression:** protected-shell hosting and auth state must remain stable

## Rollback

Revert the native inbox route to placeholder hosting until feed and refresh behavior are corrected.
