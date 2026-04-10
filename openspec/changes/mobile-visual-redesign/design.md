## Context

The mobile app currently uses an inconsistent icon system with ad-hoc icon implementations, no motion design language, and maintains a light/dark mode toggle despite product direction toward dark-mode-only. The canonical dark color tokens exist in `packages/platform/ui/src/tokens/colors.ts` as `darkColors` but are not being used exclusively.

Current state:
- Icons: Mixed implementations (custom SVG, emoji, third-party libs)
- Animations: Minimal, mostly opacity fades
- Theme: Light/dark toggle with system preference detection
- Navigation: Default React Navigation transitions

## Goals / Non-Goals

**Goals:**
- Unified icon system using Lucide React Native
- Motion design system with react-native-reanimated (spring-based, gesture-driven)
- Dark-mode-only with system preference override for accessibility
- Skeleton shimmer loading states
- Haptic feedback for key interactions
- Native-feeling navigation transitions

**Non-Goals:**
- Creating custom icon set (use Lucide as-is)
- Building animation from scratch — use reanimated presets
- Light mode support
- Animations on every interaction (focus on meaningful motion)

## Decisions

### 1. Icon Library: Lucide React Native

**Decision:** Use `lucide-react-native` as the single icon source.

**Rationale:**
- Consistent 24px grid, 2px stroke weight
- Tree-shakeable (only bundle used icons)
- Covers all UI icon needs (navigation, actions, status)
- TypeScript support, matches design aesthetic

**Alternatives considered:**
- `react-native-vector-icons` — Too heavy, limited customization
- Custom SVG components — Maintenance burden, inconsistent sizing
- `expo-vector-icons` — Less tree-shakeable, tied to Expo ecosystem

### 2. Animation System: react-native-reanimated v3

**Decision:** Use reanimated's `Animated.View`, `Animated.Text`, `useAnimatedStyle`, `withSpring`, `withTiming`.

**Rationale:**
- Worklet-based (runs on UI thread, no JS bridge)
- Spring physics feel native
- Already in dependencies via `react-native-worklets`
- Composable animation primitives

**Animation presets to implement:**
```typescript
// Enter animations
fadeIn: { duration: 200, easing: Easing.out(Easing.ease) }
slideUp: { translateY: 20 → 0, opacity: 0 → 1, spring: { damping: 15 } }
scaleIn: { scale: 0.95 → 1, opacity: 0 → 1, spring: { damping: 12 } }

// Exit animations
fadeOut: { duration: 150, opacity: 1 → 0 }
slideDown: { translateY: 0 → -10, opacity: 1 → 0 }

// Micro-interactions
pressScale: { scale: 1 → 0.97, duration: 100 }
```

**Alternatives considered:**
- `react-native-animatable` — Blocking animations on JS thread
- `framer-motion` — Heavy, React-only (not React Native optimized)
- Layout animations only — Insufficient control

### 3. Theme: Dark-Only with System Override

**Decision:** Theme provider returns dark colors exclusively. `useColorScheme()` hook detects system preference but always returns dark palette.

**Rationale:**
- Simplifies theme logic (no toggle state)
- Dark palette in tokens is production-ready
- System preference detection remains for future "system" option
- CSS variables and Restyle theme both use darkColors

**Implementation:**
```typescript
const theme = createTheme({
  colors: {
    ...darkColors,
  },
});
```

**Alternatives considered:**
- Keep toggle but default to dark — User confusion, inconsistent UX
- User preference stored in async storage — Adds complexity, no current need

### 4. Haptic Feedback: expo-haptics

**Decision:** Use `expo-haptics` for haptic feedback patterns.

**Rationale:**
- Works across iOS hardware (different intensity profiles)
- Native feel for button presses, selections
- Simple API: `haptics.impactAsync(style)`

**Alternatives considered:**
- `react-native-haptic-feedback` — Less maintained, fewer patterns
- Custom implementation — Platform-specific complexity

### 5. Navigation Transitions: Native Stack with Spring Config

**Decision:** Configure React Navigation native stack with custom spring animation.

**Rationale:**
- Native stack has best performance (UIKit/Android navigation primitives)
- Spring config provides iOS-native feel
- Gesture-based back navigation preserved

**Config:**
```typescript
const screenOptions = {
  animation: 'slide_from_right',
  animationDuration: 250,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};
```

## Risks / Trade-offs

[Risk] Lucide icons may not have all custom icons needed for brand
→ Mitigation: Lucide is extensible — can add custom SVG icons to a `CustomIcon` component

[Risk] reanimated worklets require babel plugin (already configured)
→ Mitigation: Verify babel.config.js includes `react-native-worklets/plugin` before reanimated/plugin (per mobile-expo-config spec)

[Risk] Skeleton shimmer requires reanimated for smooth 60fps
→ Mitigation: Use reanimated's `useAnimatedReaction` with linear timing, not CSS animation

[Risk] Haptics may feel different across iPhone models
→ Mitigation: Use `haptics.impactAsync('medium')` — most consistent across devices

## Open Questions

1. Should skeleton shimmer be applied to all loading states, or only specific screens?
   - Propose: Start with chat message loading, note list loading only

2. What icon sizes should be standardized?
   - Propose: 20px (inline), 24px (default), 32px (headers), 48px (empty states)

3. Should haptic feedback be behind a setting?
   - Propose: No, always on for key actions (button press, swipe, selection)
