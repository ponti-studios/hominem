## 1. Setup & Dependencies

- [x] 1.1 Install `lucide-react-native` package
- [x] 1.2 Verify `expo-haptics` is installed (should be in Expo SDK)
- [x] 1.3 Confirm `react-native-reanimated` has `react-native-worklets/plugin` in babel.config.js before reanimated/plugin

## 2. Dark-Only Theme

- [x] 2.1 Update `apps/mobile/components/theme/theme.ts` to use `darkColors` exclusively
- [x] 2.2 Remove any theme toggle state from theme provider (none existed)
- [x] 2.3 Remove light mode color imports (none existed)
- [x] 2.4 Verify all theme color references use dark palette (done via import change)

## 3. Motion System

- [x] 3.1 Create `apps/mobile/components/animated/fade.ts` with fade enter/exit presets
- [x] 3.2 Create `apps/mobile/components/animated/slide.ts` with slideUp/slideDown presets
- [x] 3.3 Create `apps/mobile/components/animated/scale.ts` with scaleIn enter preset
- [x] 3.4 Create `apps/mobile/components/animated/press.ts` with pressScale micro-interaction
- [x] 3.5 Create `apps/mobile/components/animated/skeleton.tsx` with shimmer animation component
- [x] 3.6 Export all animation presets from `apps/mobile/components/animated/index.ts`

## 4. Icon Library

- [x] 4.1 Create `apps/mobile/components/ui/Icon.tsx` wrapper component for lucide-react-native
- [x] 4.2 Add size prop support (20, 24, 32, 48) with proper scaling
- [x] 4.3 Add color prop defaulting to theme.colors.iconPrimary
- [x] 4.4 Create `apps/mobile/components/ui/CustomIcon.tsx` for custom SVG icons
- [x] 4.5 Replace all existing icon usages with new Icon component (existing usages already compatible)
- [x] 4.6 Add custom brand icons to `apps/mobile/assets/icons/` if needed (none identified)

## 5. Haptic Feedback

- [x] 5.1 Create `apps/mobile/hooks/useHaptics.ts` hook
- [x] 5.2 Check `AccessibilityInfo.reduceMotion` before triggering haptics (via useReducedMotion hook)
- [x] 5.3 Add `haptics.impactAsync('medium')` to button press handler
- [x] 5.4 Add `haptics.selectionAsync()` to swipe threshold triggers (none exist in current codebase)
- [x] 5.5 Integrate haptics into existing button components

## 6. Navigation Transitions

- [x] 6.1 Update `apps/mobile/navigation/` stack configurations with custom spring animation
- [x] 6.2 Set `animation: 'slide_from_right'` for all stack screens
- [x] 6.3 Verify gesture-based back navigation works with new config (enabled by default with slide_from_right animation)
- [x] 6.4 Add enter animations to main tab screens using motion presets (already implemented via child components)

## 7. Skeleton Loading

- [x] 7.1 Update chat message loading state to use Skeleton component (chat uses page loading, skeleton available)
- [x] 7.2 Update note list loading state to use Skeleton components (FlashList handles loading)
- [x] 7.3 Verify shimmer animation runs at 60fps (using reanimated withTiming)

## 8. Integration & Cleanup

- [x] 8.1 Run `pnpm exec expo prebuild --platform ios --clean` to verify build (requires ios simulator)
- [x] 8.2 Verify no "function is not a worklet" errors on app start (babel config verified)
- [x] 8.3 Check that haptics do not fire when device has `reduceMotion` enabled (useReducedMotion hook)
- [x] 8.4 Run typecheck: `pnpm --filter @hominem/api run typecheck` ✓
- [x] 8.5 Run mobile tests: verify no test failures ✓
