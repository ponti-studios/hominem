# mobile-component-structure Specification

## Purpose

Defines directory and file organization rules for `mobile/components/` to enforce strict separation between presentation components and logic (hooks).

## ADDED Requirements

### Requirement: Presentation components in `components/`

All React components that render UI SHALL live in `mobile/components/`.

**Rationale**: Presentation components are the view layer. They should be centrally located.

#### Scenario: Component location
- **WHEN** a developer creates a React component that renders UI
- **THEN** the component file SHALL be created in `mobile/components/<directory>/`
- **AND** the file SHALL use PascalCase.tsx naming

### Requirement: Hooks in `mobile/hooks/`

All custom hooks (functions starting with `use`) SHALL live in `mobile/hooks/`, NOT in component files.

**Rationale**: Hooks are logic, not presentation. Co-locating them with components violates separation of concerns and makes reuse difficult.

#### Scenario: Moving hooks from component files
- **WHEN** `useResumableSessions` exists in `components/chat/session-card.tsx`
- **THEN** it SHALL be moved to `mobile/hooks/useResumableSessions.ts`
- **AND** the component file SHALL only contain the `InboxItem` component

#### Scenario: Moving archived sessions hook
- **WHEN** `useArchivedSessions` exists in `components/chat/session-card.tsx`
- **THEN** it SHALL be moved to `mobile/hooks/useArchivedSessions.ts`

### Requirement: Feature directories group related components

Components and their types for a specific feature SHALL be grouped in a named directory under `components/`.

**Rationale**: Organized grouping makes the codebase navigable.

#### Scenario: Composer directory
- **WHEN** composer-related components are evaluated
- **THEN** they SHALL live in `mobile/components/composer/`
- **AND** `mobile/components/input/` SHALL be renamed to `mobile/components/composer/`

### Requirement: Shared utilities use `shared/` subdirectory

Reusable utilities that cross-cut multiple features MAY use a `shared/` subdirectory.

**Rationale**: Not everything fits neatly into one feature directory.

#### Scenario: Icons in shared
- **WHEN** icon components are evaluated
- **THEN** they SHALL live in `mobile/components/ui/`
- **AND** `LucideIcon.tsx` and `SvgIcon.tsx` SHALL be the canonical names

### Requirement: Design system animations are mandatory

Animation components SHALL use design system motion tokens from `theme/motion.ts`.

**Rationale**: Consistent motion creates cohesive UX. Hard-coded animation values break the design system.

#### Scenario: Using FadeIn component
- **WHEN** a FadeIn animation is needed
- **THEN** the `FadeIn` component from `components/animated/` SHALL be used
- **AND** it SHALL use `VOID_MOTION_ENTER`, `VOID_EASING_ENTER` from `theme/motion.ts`

#### Scenario: Custom animations
- **WHEN** a component needs animation
- **THEN** it SHALL use tokens from `theme/motion.ts` (durations, easings, distances)
- **AND** it SHALL NOT hard-code values like `duration: 150` or `easing: Easing.out(Easing.cubic)`
