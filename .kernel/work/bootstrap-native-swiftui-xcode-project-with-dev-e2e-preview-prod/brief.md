# Work Brief

## Goal

Bootstrap native SwiftUI Xcode project with dev/e2e/preview/production variants

## Context

The Expo app at `apps/mobile/` is the current production iOS client and remains the reference implementation throughout migration. This work item creates a **standalone native SwiftUI Xcode project** at `apps/native/` — completely separate from the Expo project, using XcodeGen for reproducible project generation.

The Expo app must not be modified. The native project starts empty (a placeholder `ContentView`) and fills with features across Phases 2–5.

## Scope

### In scope

- `apps/native/project.yml` — XcodeGen spec for the Xcode project
- 4 build configurations matching Expo variants: Debug Dev, Debug E2E, Debug Preview, Release Production + Release Preview
- 4 schemes: Hakumi Dev, Hakumi E2E, Hakumi Preview, Hakumi (production)
- Bundle IDs per variant: `com.pontistudios.hakumi.dev` / `.e2e` / `.preview` / `com.pontistudios.hakumi`
- URL schemes per variant: `hakumi-dev`, `hakumi-e2e`, `hakumi-preview`, `hakumi`
- Shared entitlements file using build-setting substitution for app groups and keychain
- Entitlements: push notifications, Siri, app groups, keychain access
- `App.swift` — `@main` SwiftUI entry point
- `ContentView.swift` — placeholder root view
- Minimal `Assets.xcassets` (AppIcon + AccentColor)
- iOS 16.0 minimum deployment target (NavigationStack requires 16+)
- Development team: `3QHJ2KN8AL`

### Out of scope

- Design tokens, component library, routing — those are separate work items
- CocoaPods or SPM packages — no dependencies in this bootstrap
- Real screens or feature code — placeholder only
- CI/CD integration — Phase 6

## Success Criteria

The work is complete when all of the following are true:

- [ ] `apps/native/project.yml` exists and `xcodegen generate` runs without errors
- [ ] `xcodebuild -list -project apps/native/Hakumi.xcodeproj` lists all 4 schemes
- [ ] Each scheme maps to the correct bundle identifier (verified by inspecting build settings)
- [ ] `xcodebuild build -scheme "Hakumi Dev" -configuration "Debug Dev" -destination "generic/platform=iOS Simulator"` exits 0
- [ ] All tasks in tasks.md are checked off
- [ ] journal.md records the iOS minimum version decision

## Constraints

- Must not modify anything under `apps/mobile/` — Expo is the live reference
- iOS 16.0 minimum (NavigationStack; see open question in initiative plan — we're bumping from 15.1)
- Swift 6.0
- XcodeGen 2.x must be used (available at `/opt/homebrew/bin/xcodegen`)
- Development team `3QHJ2KN8AL` locked from Expo project

## Dependencies

- XcodeGen installed (verified: `/opt/homebrew/bin/xcodegen` v2.45.3)
- Xcode and command-line tools installed (verified: Swift 6.3.1)

## Related Work

- Parent: `.kernel/projects/phase-1-native-foundation`
- Milestone: `1-1-app-bootstrap-variants-and-design-system`
- Blocks: `build-swiftui-design-token-system-color-typography-spacing-motio`
- Blocks: `build-swiftui-primitive-component-library-buttons-inputs-cards-t`
- Blocks: all Phase 2+ work items
