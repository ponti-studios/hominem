# Milestone Brief

## Goal

1.1 — App bootstrap, variants, and design system: create the native Xcode project, configure all four build variants with correct bundle IDs and entitlements, and port the complete design token system and primitive component library from Expo.

## Target Date

2025-05-15

## Context

This milestone is the first concrete deliverable of the entire migration. Nothing else can be built until there is a buildable, CI-verified Xcode project. Phase 1 cannot start until Phase 0 is confirmed complete (parity matrix frozen, API contracts documented) — that gate is already passed.

Before this milestone: no native Xcode project exists; all iOS development happens through Expo's managed workflow.

After this milestone: the native Xcode project builds cleanly on CI for all four variants; the design system is implemented in Swift and verified on real devices; primitive components are ready for use in every subsequent phase. Milestone 1.2 can begin immediately.

## Scope

### In scope

- Xcode project creation with `HakumiApp` target, Swift Package Manager integration
- Four build schemes: Dev (`com.pontistudios.hakumi.dev`), E2E (`com.pontistudios.hakumi.e2e`), Preview (`com.pontistudios.hakumi.preview`), Production (`com.pontistudios.hakumi`)
- Per-variant xcconfig files: bundle ID, API base URL, PostHog API key, feature flags
- App entitlements for all variants: Associated Domains, App Groups, Push Notifications capability (not yet wired), Keychain Sharing
- App icon assets and launch screen (`LaunchScreen.storyboard` or SwiftUI equivalent) for all variants
- Brand assets migrated from Expo `assets/` directory
- SwiftUI design token system:
  - Color palette (`Color+Brand.swift`, `Color+Semantic.swift`) matching Expo `components/theme/colors`
  - Typography scale (`Font+App.swift`) matching Expo `components/typography/Text.tsx` styles
  - Spacing constants (`Spacing.swift`) matching Expo layout values
  - Surface styles (card backgrounds, divider colors, overlay tints)
  - Shadow levels (matching Expo shadow definitions)
  - Motion defaults (spring and ease animation constants)
- Primitive SwiftUI component library:
  - Buttons: primary, secondary, ghost, destructive — matching Expo `components/ui/Button`
  - Text inputs: single-line, multiline — matching Expo form input components
  - Cards: default container surface — matching Expo `components/ui/Card`
  - Modals: sheet presentation wrapper — matching Expo modal patterns
  - Form primitives: label-field pair, section header, separator
- Design system preview screen (accessible only in dev variant) showing all tokens and primitives

### Out of scope

- Any routing or navigation setup — Milestone 1.2
- Root app container (`HakumiApp.swift`) beyond the bare minimum to load the design system preview — Milestone 1.2
- PostHog or Sentry instrumentation — Milestone 1.2
- Any product surface or placeholder screen — Milestone 1.2
- Deep link handling — Milestone 1.2
- App Shortcuts, widget target, intents extension — Phase 5

## Acceptance Criteria

This milestone is complete when:

- [ ] `xcodebuild -scheme Dev clean build` passes on CI with zero warnings that are treated as errors
- [ ] All four variants build and install on a real device with correct bundle IDs verified via Xcode Device console
- [ ] Entitlements match the current Expo `app.config.ts` configuration for all four variants (verified by diff against known entitlements)
- [ ] Design system preview screen (dev variant only) renders all color, typography, spacing, surface, and shadow tokens without any hardcoded values
- [ ] All primitive components render on a real iPhone 12 (iOS 15.1) without visual regressions against the Expo equivalents (screenshot comparison documented)
- [ ] Token extraction is complete: zero hardcoded hex values or font size literals anywhere in the Swift source
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **bootstrap-native-swiftui-xcode-project-with-dev-e2e-preview-prod**: Create Xcode project, configure four variants with correct bundle IDs, xcconfig files, entitlements, app icons, and launch screens. CI must be green before any other work item merges. Prerequisite: SwiftUI architecture decision made, Apple Developer account access confirmed.
2. **build-swiftui-design-token-system-color-typography-spacing-motio**: Extract all token values from Expo `components/theme`, implement in Swift as type-safe enums and extensions, verify on real device. Prerequisite: Xcode project exists and builds.
3. **build-swiftui-primitive-component-library-buttons-inputs-cards-t**: Build primitive SwiftUI components using the token system, add to design system preview screen, screenshot-compare against Expo equivalents. Prerequisite: design token system complete.

## Dependencies

- Phase 0 complete: parity matrix frozen — confirmed
- SwiftUI-first architecture decision and UIKit escape hatch policy — must be written before work begins
- Apple Developer team access with permissions to create new bundle IDs and configure capabilities
- Expo `components/theme` source locked as reference (no concurrent theme changes during porting)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token drift: Expo theme changes during port | High | Freeze theme source at start of this milestone; any theme changes must be applied to both Expo and native simultaneously |
| Entitlement mismatch discovered late | High | Cross-check entitlements against `app.config.ts` as part of the bootstrap work item before closing it |
| SwiftUI Previews diverge from real device rendering | Med | All acceptance criteria must be verified on a real iPhone 12 running iOS 15.1, not just in Xcode Previews |
| xcconfig complexity for four variants causes merge conflicts | Med | Establish xcconfig naming conventions and ownership before work begins; single reviewer owns variant config |
| App icon asset generation for four variants is time-consuming | Low | Use `appicon.co` or similar tooling; budget 0.5 days; do not block on this |
