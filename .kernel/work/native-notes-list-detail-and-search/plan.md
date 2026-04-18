# Implementation Plan

## Goal

Native notes list, detail, and search parity

## Approach

Deliver note discovery and open behavior first so the editor work can attach to stable route and data behavior. Keep create and search behavior within scope only to the extent they are required to reach and use note detail reliably.

## Key Decisions

| Decision                   | Choice                                                | Rationale                                                   | Alternative Considered                                                          |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Route-first notes delivery | List and detail behavior land before editor semantics | Separates navigation and data parity from editor complexity | Building the editor first, rejected because it depends on stable route behavior |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm note browse, search, and open behaviors that must match Expo

### 2. Implement the core path

- Build notes list and detail routes
- Recreate create-open and search dependencies needed by the route flow

### 3. Verify behavior with tests

- Test note browse and detail behaviors
- Verify note navigation on device against Expo

### 4. Capture follow-up work

- Record route and data assumptions that the editor work depends on

## Risks

| Risk                                                               | Likelihood | Impact | Mitigation                                                        |
| ------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------- |
| Search and open behavior are underdefined relative to Expo         | Med        | High   | Validate route and open flows directly during review              |
| Notes route parity hides state issues that only surface in editing | Med        | Med    | Keep the editor work separate and depend on stable route outcomes |

## Validation

How to verify this work is correct:

- **Automated:** notes route and search behavior tests
- **Manual:** browse, search, create, and open notes on device and compare with Expo
- **Regression:** inbox and shell behavior must remain stable

## Rollback

Revert native notes browse and detail routing to placeholder behavior until route parity is corrected.
