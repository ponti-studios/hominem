# Work Brief

## Goal

Build SwiftUI design token system — color, typography, spacing, motion

## Context

The canonical token source lives in `packages/platform/ui/src/tokens/` (TypeScript). This work ports those exact values to Swift so the native app matches the Expo reference without ad-hoc values. All colors, type scales, spacing, radii, shadows, and motion parameters must be locked from the TS source before any component work begins.

The app is dark-mode only (single dark theme). No adaptive/light-mode variants needed at this stage.

## Scope

### In scope

- `Hakumi/DesignSystem/Colors.swift` — all color tokens from `packages/platform/ui/src/tokens/colors.ts`
- `Hakumi/DesignSystem/Typography.swift` — text variants from `apps/mobile/components/theme/theme.ts` (largeTitle → caption2 + mono), font family helpers
- `Hakumi/DesignSystem/Spacing.swift` — 8-step spacing scale (4, 8, 12, 16, 24, 32, 48, 64) + named aliases
- `Hakumi/DesignSystem/Radii.swift` — corner radius tokens (sm=6, md=10, lg=14, xl=18, full=9999, icon=20)
- `Hakumi/DesignSystem/Shadows.swift` — low / medium / high shadow tokens
- `Hakumi/DesignSystem/Motion.swift` — duration constants and SwiftUI `Animation` presets (enter/exit/standard/breezy)
- `Color(hex:)` initializer for clean hex literals

### Out of scope

- Light mode / adaptive color sets — dark only for now
- Custom font loading — using system SF Pro throughout (matches Expo mobile target)
- SwiftUI component primitives — separate work item

## Success Criteria

The work is complete when all of the following are true:

- [ ] `Hakumi/DesignSystem/` contains all 6 token files
- [ ] Every named token from the TS source has a 1:1 Swift counterpart (spot-checked against `colors.ts`, `typography.ts`, `spacing.ts`)
- [ ] `xcodebuild build -scheme "Hakumi Dev"` exits 0 with no warnings from the token files
- [ ] Colors are accessible as `Color.Hakumi.bgBase`, spacing as `Spacing.sm`, motion as `Motion.enter`
- [ ] All tasks in tasks.md are checked off

## Constraints

- iOS 26.0 minimum — can use any modern SwiftUI APIs freely
- Dark-only: no `Color(light:dark:)` or `colorScheme` environment branching in these files
- Token values must be verbatim copies from the TS source — no creative interpretation

## Dependencies

- `bootstrap-native-swiftui-xcode-project-with-dev-e2e-preview-prod` — done ✓

## Related Work

- Parent: `.kernel/projects/phase-1-native-foundation`
- Milestone: `1-1-app-bootstrap-variants-and-design-system`
- Blocked by: bootstrap work item (done)
- Blocks: `build-swiftui-primitive-component-library-buttons-inputs-cards-t`
