# Research: Omiro Workspace Navigation

## Confirmed constraints

- Omiro is Apple-only.
- `@expo/ui/swift-ui` provides `Host`, `Picker`, `TextField`, `Image`, and modifiers needed for the approved header.
- SwiftUI trees must be isolated in `.ios.tsx` components and wrapped in `Host`.
- The existing `TasksPane` already represents Tasks content inside the Workspace surface.
- Maestro requires stable IDs for app-owned controls.

## Findings that do not authorize architecture changes

- Expo Router offers `NativeTabs`, but that API is not appropriate for the approved product model because the user explicitly rejected a bottom tab bar and separate Tasks root.
- Native stack search/header slots may not express the reference composition. That justifies a screen-owned header, not a change to the Workspace information architecture.
- Liquid Glass is visual treatment only. It cannot be required for interaction, layout measurement, accessibility, or state semantics.

## Decision rule

Technical findings describe constraints and available tools. They do not decide product structure. If a constraint appears to require a different navigation hierarchy, document the constraint and stop for user direction.

