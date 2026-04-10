## ADDED Requirements

### Requirement: Dark-only theme is enforced at the theme provider level

The mobile app SHALL render only dark theme colors, ignoring any light mode preference.

#### Scenario: Theme provider returns dark palette
- **WHEN** the app initializes
- **THEN** the theme provider uses `darkColors` from `@hominem/ui/tokens/colors`
- **AND** no light mode colors are accessible through the theme

### Requirement: Restyle theme uses dark color tokens

The Restyle `theme.ts` configuration SHALL use dark color tokens exclusively.

#### Scenario: Theme colors match dark palette
- **WHEN** components access `theme.colors.foreground`
- **THEN** the value is `rgba(245, 246, 248, 1)` (dark mode foreground)
- **AND** the value is NOT `rgba(25, 25, 24, 1)` (light mode foreground)

### Requirement: No theme toggle exists in UI

The mobile app SHALL NOT expose a theme toggle or light/dark switch to users.

#### Scenario: No theme toggle in settings
- **WHEN** user navigates to settings screen
- **THEN** no "Theme", "Appearance", or "Dark Mode" toggle is displayed

### Requirement: System preference is detected but not used for theme switching

The app SHALL detect system color scheme preference via `useColorScheme()` for potential future use, but SHALL NOT switch themes based on it.

#### Scenario: System preference hook returns value but theme stays dark
- **WHEN** `useColorScheme()` returns `'light'` or `'dark'`
- **THEN** the rendered theme remains the dark palette
