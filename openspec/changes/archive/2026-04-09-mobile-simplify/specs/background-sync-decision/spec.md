## REMOVED Requirements

### Requirement: Background sync task registration

**Reason**: The registered background task in `lib/background-sync.ts` only timestamps itself with no actual sync logic. It provides no value and adds maintenance overhead.

**Migration**: If background sync is needed in the future, create a new change with a full implementation spec. The current skeleton does not serve as a foundation.

### Requirement: Background task imports and expo-background-task dependency

**Reason**: With the background sync skeleton removed, `expo-background-task` may no longer be needed by the mobile app.

**Migration**: Verify if any other code uses `expo-background-task` before removing the dependency from `package.json`.

---

## ADDED Requirements

### Requirement: Background sync SHALL NOT register dead task

The mobile app SHALL NOT register a background task that only timestamps itself without performing actual synchronization work.

#### Scenario: No BACKGROUND_SYNC_TASK is registered

- **WHEN** examining `lib/background-sync.ts` or equivalent
- **THEN** there is no `TaskManager.defineTask` call for `background-sync`
- **OR** the file does not exist

### Requirement: expo-background-task dependency SHALL be removed

If no other code uses `expo-background-task`, the dependency SHALL be removed from `package.json`.

#### Scenario: expo-background-task is not in package.json

- **WHEN** examining `apps/mobile/package.json`
- **THEN** `expo-background-task` is not listed in dependencies
