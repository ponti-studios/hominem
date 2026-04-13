# mobile-component-conventions Specification

## Purpose

Defines naming conventions for all React components, hooks, types, and files in the mobile app to ensure consistency and clarity.

## ADDED Requirements

### Requirement: Component file names use PascalCase

Component files in `mobile/components/` SHALL use PascalCase with `.tsx` extension.

**Rationale**: Standard React convention for distinguishing components from other files at a glance.

#### Scenario: Component file naming
- **WHEN** a developer creates a new component file
- **THEN** the file name SHALL be PascalCase.tsx (e.g., `Composer.tsx`, `InboxItem.tsx`)

### Requirement: Hook file names use camelCase

Hook files SHALL use camelCase with `.ts` extension, prefixed with `use`.

**Rationale**: Hooks are functions, not components, and follow JavaScript function naming conventions.

#### Scenario: Hook file naming
- **WHEN** a developer creates a new hook file
- **THEN** the file name SHALL be camelCase.ts starting with `use` (e.g., `useComposerActions.ts`)

### Requirement: Type file names use camelCase

Type-only files SHALL use camelCase with `.ts` extension.

**Rationale**: Types are part of the code, not JSX, so `.ts` is appropriate.

#### Scenario: Type file naming
- **WHEN** a developer creates a file with only types
- **THEN** the file name SHALL be camelCase.ts (e.g., `composer.types.ts`)

### Requirement: No redundant prefixes

Types and components SHALL NOT use prefixes redundant with their directory context.

**Rationale**: All code is in `mobile/components/`, so "Mobile" prefix is noise.

#### Scenario: Removing Mobile prefix
- **WHEN** a type or component name is evaluated
- **THEN** it SHALL NOT contain "Mobile" prefix
- **AND** `MobileComposer` SHALL be renamed to `Composer`

### Requirement: Meaningful names replace packaging terms

Packaging terms that describe containment rather than content SHALL be replaced with descriptive names.

**Rationale**: Names should describe what something IS, not how it's packaged.

#### Scenario: Renaming FeedbackBlock
- **WHEN** `FeedbackBlock` is evaluated
- **THEN** it SHALL be renamed to `Alert`
- **AND** it SHALL export `Alert` (not `FeedbackBlock`)

#### Scenario: Renaming LoadingState
- **WHEN** `LoadingState` is evaluated
- **THEN** it SHALL be renamed to `Loading`
- **AND** it SHALL export `Loading` (not `LoadingState`)

#### Scenario: Renaming AuthShell
- **WHEN** `AuthShell` is evaluated
- **THEN** it SHALL be renamed to `AuthLayout`
- **AND** it SHALL export `AuthLayout` (not `AuthShell`)

### Requirement: Message factories use descriptive names

Files containing message or text generation functions SHALL use descriptive names, not "contracts".

**Rationale**: "Contracts" is not TypeScript-canonical. Names should describe the content.

#### Scenario: Renaming contracts.ts
- **WHEN** `error-boundary/contracts.ts` is evaluated
- **THEN** it SHALL be renamed to `error-boundary/messages.ts`
- **AND** functions SHALL maintain their names (createFeatureFallbackLabel, createRootFallbackMessage)

### Requirement: Voice hooks reflect their role

Voice recording and playback hooks SHALL reflect their role in the composer voice flow.

**Rationale**: Hooks for recording user voice input and playing back LLM responses should have names that clarify their purpose.

#### Scenario: Renaming voice hooks
- **WHEN** `use-recorder.ts` is evaluated
- **THEN** it SHALL be renamed to `useInput.ts`
- **AND** it SHALL export `useInput` (not `useRecorder`)

#### Scenario: Renaming playback hook
- **WHEN** `use-playback.ts` is evaluated
- **THEN** it SHALL be renamed to `useResponse.ts`
- **AND** it SHALL export `useResponse` (not `usePlayback`)
