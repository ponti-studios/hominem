# Work Brief

## Goal

Build SwiftUI primitive component library — buttons, inputs, cards, toasts

## Context

The Expo app's component library lives in `apps/mobile/components/ui/` and `packages/platform/ui/src/components/`. This work ports those primitives to SwiftUI, consuming the design token system built in the previous work item. All components reference tokens only — no hardcoded values.

## Scope

### In scope

- `AppButton` — variants: default/secondary, primary, destructive, ghost, outline, link. Sizes: xs, sm, md, lg, icon, icon-xs, icon-sm, icon-lg. States: loading, disabled, pressed.
- `AppTextField` — single-line, with label, placeholder, disabled, error, helpText. Focus ring via @FocusState.
- `AppTextArea` — multiline TextEditor, same field chrome as AppTextField. Min height 120pt.
- `Card` compound views — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- `Surface` — elevation variants (surface, elevated, overlay), optional border and shadow, configurable radius.
- `Toast` — imperative API (`ToastManager` as `@Observable`), variants: default, destructive, success, warning. Shown via `.toastOverlay()` view modifier on root content.

### Out of scope

- Avatar, Badge, Checkbox, Select, Popover, Sheet — separate work items
- Animations within components beyond pressed-state opacity — fine-tuned transitions are Phase 2+
- Accessibility audit — correctness first, a11y pass is a follow-up work item

## Success Criteria

The work is complete when all of the following are true:

- [ ] All 6 component files exist under `Hakumi/DesignSystem/Components/`
- [ ] `AppButton` renders correctly for all 7 variants and all 8 sizes (verified in Xcode Preview)
- [ ] `AppTextField` shows focus ring, error state, and disabled state (verified in Preview)
- [ ] `Surface` renders correct background and border per elevation variant (verified in Preview)
- [ ] `Toast` can be triggered imperatively and dismissed (verified in Preview)
- [ ] `xcodebuild build -scheme "Hakumi Dev"` exits 0 with no errors
- [ ] All tasks in tasks.md are checked off

## Constraints

- iOS 26.0 minimum — `@Observable`, `NavigationStack`, etc. all available
- All visual values come from `Color.Hakumi.*`, `Spacing.*`, `Radii.*`, `Shadows.*`, `AppTypography.*` — no literals
- No external dependencies — pure SwiftUI only

## Dependencies

- `build-swiftui-design-token-system-color-typography-spacing-motio` — done ✓

## Related Work

- Parent: `.kernel/projects/phase-1-native-foundation`
- Milestone: `1-1-app-bootstrap-variants-and-design-system`
- Blocked by: design token work item (done)
- Blocks: all Phase 2 feature work items
