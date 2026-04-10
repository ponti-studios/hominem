## ADDED Requirements

### Requirement: Error boundaries SHALL be function components

All error boundary components (`RootErrorBoundary`, `FeatureErrorBoundary`) SHALL be implemented as function components using React hooks.

#### Scenario: RootErrorBoundary is a function component

- **WHEN** examining `components/error-boundary/root-error-boundary.tsx`
- **THEN** it is a function component (not a class extending `Component`)
- **AND** it uses `useState` for error state
- **AND** it uses `useEffect` for error logging (equivalent to `componentDidCatch`)

#### Scenario: FeatureErrorBoundary is a function component

- **WHEN** examining `components/error-boundary/feature-error-boundary.tsx`
- **THEN** it is a function component
- **AND** it accepts `featureName` as a prop

### Requirement: Error state SHALL use useState

The error state SHALL be managed via `useState<BoundaryState>()` where `BoundaryState = { hasError: boolean; error: Error | null; }`.

#### Scenario: Error state is initialized correctly

- **WHEN** `RootErrorBoundary` renders for the first time without error
- **THEN** `hasError` is `false` and `error` is `null`

#### Scenario: Error state captures caught errors

- **WHEN** a child component throws an error
- **THEN** `hasError` becomes `true` and `error` contains the thrown value
- **AND** the fallback UI renders

### Requirement: Error reset SHALL use callback

The error boundary SHALL provide a reset mechanism via `useCallback` that returns the component to its initial state.

#### Scenario: Reset clears error state

- **WHEN** the user clicks "Try Again" in `RootErrorBoundary`
- **THEN** `hasError` becomes `false` and `error` becomes `null`
- **AND** the children re-render

### Requirement: Error logging SHALL occur via useEffect

The error logging (calling `logError`) SHALL happen inside `useEffect` with the error and errorInfo as dependencies.

#### Scenario: Errors are logged on capture

- **WHEN** an error is caught
- **THEN** `useEffect` runs `logError(error, errorInfo, context)`
- **AND** the PostHog `captureException` is called in production

### Requirement: In-memory error log SHALL be removed

The `errorLog` array in `utils/error-boundary/log-error.ts` SHALL be removed since it is never read by any consumer.

#### Scenario: logError does not maintain in-memory log

- **WHEN** `logError` is called
- **THEN** it does not push to any array
- **AND** it only calls `console.error` in development
- **AND** it calls `posthog.captureException` in production

### Requirement: Contracts SHALL remain unchanged

The `BoundaryState`, `BoundaryLogContext`, `createBoundaryStateFromError`, `resetBoundaryState`, and helper functions in `utils/error-boundary/contracts.ts` SHALL remain functional and types-compatible with the new function component implementation.

#### Scenario: Contract functions work with new implementation

- **WHEN** `createBoundaryStateFromError(error)` is called
- **THEN** it returns `{ hasError: true, error: error }`

#### Scenario: ResetBoundaryState returns initial state

- **WHEN** `resetBoundaryState()` is called
- **THEN** it returns `{ hasError: false, error: null }`
