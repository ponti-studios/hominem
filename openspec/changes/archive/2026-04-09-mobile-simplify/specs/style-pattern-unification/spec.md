## ADDED Requirements

### Requirement: All component styles SHALL use makeStyles hook

All React Native style objects in component files SHALL use the `makeStyles` hook pattern from `~/theme` instead of inline `StyleSheet.create` or direct `theme` imports.

#### Scenario: Components use makeStyles

- **WHEN** examining any component in `components/`
- **THEN** style definitions use `const styles = useStyles((t) => StyleSheet.create({ ... }))()`
- **AND** no `StyleSheet.create({ ... })` is called inline in JSX props

### Requirement: Direct theme imports SHALL NOT be used for styling

Components SHALL NOT import `theme` from `~/theme` and use it directly for inline style objects.

#### Scenario: No direct theme usage in style objects

- **WHEN** examining component style definitions
- **THEN** `theme` is not used directly in `style={}` props
- **AND** all theme values come through `useStyles()` callback parameter

### Requirement: Theme alias SHALL resolve to ~/theme

The `~/theme` import alias in `tsconfig.json` SHALL continue to resolve correctly after directory reorganization.

#### Scenario: Theme imports work after lib reorganization

- **WHEN** code imports from `~/theme`
- **THEN** it resolves to `lib/theme/theme.ts` (after move)

### Requirement: Migrated files SHALL use consistent pattern

Files migrated from direct `theme` import to `makeStyles` SHALL follow the pattern:

```typescript
const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: { backgroundColor: t.colors.background },
  }),
);
```

#### Scenario: makeStyles is called as a hook

- **WHEN** examining a component's style definition
- **THEN** it calls `useStyles()` as a React hook
- **AND** the returned `styles` object is used in JSX
