# Journal

- 2026-04-18T05:07:21.368Z: Created work item `bootstrap-native-swiftui-xcode-project-with-dev-e2e-preview-prod`.
- 2026-04-18: Executed bootstrap. Created `apps/hakumi-ios/` with XcodeGen project.yml, 4 schemes (Hakumi Dev, Hakumi E2E, Hakumi Preview, Hakumi), 5 build configurations, and placeholder Swift sources. `xcodebuild build -scheme "Hakumi Dev"` exits 0.

**iOS minimum version decision**: Set to iOS 16.0 (not 15.1 from initiative plan). Rationale: NavigationStack requires iOS 16+; the initiative plan's open question anticipated this bump. Recorded as a resolved decision — Phase 1 plan should be updated to close the open question.

**Development team**: `3QHJ2KN8AL` — locked from existing Expo project config.

**Architecture pattern (TCA vs Observation)**: Not yet decided. Still open in initiative plan. Must be resolved before Phase 2 begins. No code written that constrains this choice.

**No CocoaPods or SPM dependencies added**: Bootstrap is intentionally dependency-free. Dependencies will be added in Phase 1 design system work item.

**Follow-up**: The `Hakumi.xcodeproj` is checked into git alongside `project.yml`. Running `xcodegen generate` in `apps/hakumi-ios/` regenerates it at any time.
