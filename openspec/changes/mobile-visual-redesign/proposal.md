## Why

The mobile app's visual design lacks modern polish: inconsistent iconography, no motion design language, flat transitions, and maintains a light/dark mode toggle when the product should be dark-mode-only for improved focus and battery efficiency. This redesign establishes a cohesive visual identity with icons, animations, and transitions.

## What Changes

- Replace all icon components with a unified icon library (Lucide) across mobile UI
- Implement a motion design system with consistent enter/exit animations, gesture-driven transitions, and micro-interactions
- Remove light mode entirely — dark mode only with system preference override
- Apply the canonical dark color palette from design tokens
- Update navigation transitions to use native spring animations
- Add loading states with skeleton shimmer animations
- Introduce haptic feedback for key interactions

## Capabilities

### New Capabilities

- `mobile-dark-only-theme`: Implements dark-mode-only theme with no light mode toggle, using canonical dark color tokens
- `mobile-motion-system`: Unified motion primitives using react-native-reanimated — enter/exit animations, shared element transitions, gesture-driven interactions
- `mobile-icon-library`: Standardized icon system replacing ad-hoc icons with Lucide icons throughout the app
- `mobile-haptic-feedback`: Haptic feedback patterns for buttons, gestures, and transitions

### Modified Capabilities

- `mobile-expo-config`: Update asset bundle patterns and EAS build profiles to include new icon assets

## Impact

- `apps/mobile/components/` — Theme, icons, animation components
- `apps/mobile/navigation/` — Navigation transitions
- `packages/platform/ui/src/tokens/` — Dark color tokens already exist
- `packages/platform/ui/` — May need mobile-specific animation utilities
