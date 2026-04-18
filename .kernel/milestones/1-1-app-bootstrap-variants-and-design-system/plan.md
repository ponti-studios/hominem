# Milestone Plan

## Goal

1.1 — App bootstrap, variants, and design system

## Approach

Bootstrap first, tokens second, components third. XcodeGen was chosen to keep the project definition in a committed `project.yml` — the `.xcodeproj` is generated and regenerated from it. Build configurations replace xcconfig files; all per-variant values (bundle IDs, display names, URL schemes) are set as build settings and injected into `Info.plist` at build time.

Design tokens were extracted verbatim from `packages/platform/ui/src/tokens/` — the canonical TS source. No interpretation or adaptation.

## Work Item Breakdown

| Work Item | Purpose | Depends On |
|-----------|---------|-----------|
| bootstrap-native-swiftui-xcode-project-with-dev-e2e-preview-prod | XcodeGen project, 4 variants, entitlements, App.swift | none |
| build-swiftui-design-token-system-color-typography-spacing-motio | Colors, typography, spacing, radii, shadows, motion in Swift | bootstrap |
| build-swiftui-primitive-component-library-buttons-inputs-cards-t | AppButton, AppTextField/Area, Card, Surface, Toast | design tokens |

## Critical Path

Bootstrap is the bottleneck. Until `Hakumi.xcodeproj` exists and builds, no Swift code can be written.

## Sequencing Rationale

Design tokens must precede components because components reference token values. Bootstrap unlocks both in sequence.

## Deliverables

- `apps/hakumi-ios/` — standalone SwiftUI app, completely separate from `apps/mobile/` (Expo)
- `apps/hakumi-ios/project.yml` — XcodeGen spec; regenerate with `cd apps/hakumi-ios && xcodegen generate`
- 4 schemes: Hakumi Dev / E2E / Preview / Hakumi (production) with correct bundle IDs
- 5 build configurations: Debug Dev, Debug E2E, Debug Preview, Release Preview, Release Production
- `Hakumi/DesignSystem/` — 6 token files (Colors, Typography, Spacing, Radii, Shadows, Motion) + 4 component files (AppButton, AppTextField+AppTextArea, Card+Surface, Toast)
- iOS 26.0 minimum, Swift 6.0, `@Observable` architecture

## Acceptance Criteria

This milestone is complete when:

- [x] All work items are done
- [x] `xcodebuild build -scheme "Hakumi Dev"` exits 0 with no errors
- [x] All 4 schemes present with correct bundle IDs
- [x] Design token files source all values from `packages/platform/ui/src/tokens/`
- [x] AppButton, AppTextField, Card, Surface, Toast compile with Xcode Previews

## Open Questions (resolved)

- **iOS minimum**: Bumped to 26.0. NavigationStack, `@Observable`, Swift 6 require it.
- **Architecture**: `@Observable` + async/await chosen over TCA.
- **XcodeGen vs manual project**: XcodeGen chosen for reproducibility.
