# Implementation Plan

## Goal

Native upload lifecycle and failure recovery parity

## Approach

Build the upload state machine first, then validate progress, retry, and recovery semantics under real failure conditions. Keep host insertion behavior out of scope until upload outcomes are stable.

## Key Decisions

| Decision                | Choice                                                          | Rationale                                                  | Alternative Considered                                                               |
| ----------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Upload-first sequencing | Network and retry semantics land before host insertion behavior | Separates transport correctness from host-state complexity | Building host insertion first, rejected because it depends on stable upload outcomes |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm upload, retry, and recovery behaviors that must match Expo

### 2. Implement the core path

- Build upload progress and completion behavior
- Recreate failure handling, retry, and recovery transitions

### 3. Verify behavior with tests

- Test upload-state transitions and retry logic
- Verify failure and recovery behavior on device against Expo

### 4. Capture follow-up work

- Record host-state assumptions needed by shared attachment state work

## Risks

| Risk                                                        | Likelihood | Impact | Mitigation                                                  |
| ----------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------- |
| Failure behavior is under-tested compared to the happy path | Med        | High   | Treat retry and recovery as first-class acceptance criteria |
| Upload state becomes too tied to one surface                | Med        | Med    | Keep the state model reusable across note and chat hosts    |

## Validation

How to verify this work is correct:

- **Automated:** upload-state and retry tests
- **Manual:** verify progress, failure, retry, and recovery on device
- **Regression:** composer and chat route behavior must remain stable

## Rollback

Disable native file-upload flows and return to non-file composer behavior until upload parity is corrected.
