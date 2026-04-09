## ADDED Requirements

### Requirement: globalThis.fetch SHALL NOT be monkey-patched

The `ApiConnectionProvider` SHALL NOT replace `globalThis.fetch` with a custom implementation.

#### Scenario: globalThis.fetch remains unchanged

- **WHEN** examining `lib/api/api-connection.tsx`
- **THEN** there is no assignment to `globalThis.fetch`
- **AND** `globalThis.fetch` is not wrapped or intercepted

### Requirement: API connection SHALL rely on RPC client retry

The `ApiConnectionProvider` SHALL NOT implement custom reconnection logic. API retry SHALL be handled by `@hominem/rpc` client and React Query retry configuration.

#### Scenario: ApiConnectionProvider does not wrap fetch

- **WHEN** examining `ApiConnectionProvider`
- **THEN** it does not call `globalThis.fetch = ...`
- **AND** it does not track fetch call results

### Requirement: ApiReconnectChip SHALL be removed or simplified

The `ApiReconnectChip` component SHALL either be removed entirely or render nothing.

#### Scenario: No reconnect UI is shown

- **WHEN** the API is unreachable
- **THEN** no "Warming up the API" chip is displayed
- **OR** `ApiReconnectChip` is removed from `app/_layout.tsx`

### Requirement: ApiConnectionProvider MAY be removed

If no code depends on `ApiConnectionContext`, the `ApiConnectionProvider` SHALL be removed from the provider tree.

#### Scenario: Provider tree is flattened

- **WHEN** examining `app/_layout.tsx`
- **THEN** `ApiConnectionProvider` is not present
- **AND** `ApiReconnectChip` is not rendered

### Requirement: API errors SHALL be handled by React Query

Network errors from API calls SHALL be handled by React Query's built-in retry mechanism and error tracking.

#### Scenario: React Query handles API errors

- **WHEN** an API call returns 5xx
- **THEN** React Query retries the request according to `queryClientConfig.defaultOptions.queries.retry`
- **AND** the error is captured via `onError` in `ApiProvider`
