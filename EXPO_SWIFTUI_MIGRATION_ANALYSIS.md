# Expo SwiftUI Components Migration Analysis

## Executive Summary

Your project has **117 web-focused UI components** in `packages/platform/ui` (built with Radix UI and Tailwind), while simultaneously using **Expo's native SwiftUI components** in your mobile app. Most platform UI components cannot be migrated to Expo SwiftUI because they're web-specific (web-only patterns like modals, popovers, complex form handling). However, you can **eliminate redundancy** and **standardize** your native iOS surfaces by adopting more Expo SwiftUI components.

---

## Available Expo SwiftUI Components

Expo UI v55 provides **direct 1-to-1 mappings** to native SwiftUI primitives:

### Layout Components
- **Host** - Required container for all SwiftUI views (wraps UIHostingController)
- **HStack** - Horizontal layout
- **VStack** - Vertical layout
- **Spacer** - Flexible spacing
- **Form** - Form container
- **List** - List container
- **Section** - Grouped form/list elements

### Display Components
- **Text** - Text rendering with modifiers
- **Image** - System icons via `systemName` prop
- **CircularProgress** - Circular progress indicators
- **LinearProgress** - Linear progress bars

### Interactive Components
- **Button** - Native buttons with `onPress` handlers
- **Toggle** - On/off switches
- **Slider** - Value adjusters
- **Menu** - Context/popup menus
- **ContextMenu** - Long-press menus

### Modifiers
- `buttonStyle`, `font`, `frame`, `padding`, `foregroundStyle`, `submitLabel`, `disabled`, `controlSize`, `glassEffect`, `background`

---

## Current Expo SwiftUI Usage in Your Project

### Files Using Expo SwiftUI Components

1. **[classification-review.tsx](apps/mobile/components/chat/classification-review.tsx)** - Uses `Button`, `HStack`, `Host`, modifiers
2. **[conversation-menu.tsx](apps/mobile/components/chat/conversation-menu.tsx)** - Uses `Button`, `Image`, `Menu`, modifiers
3. **[EmptyState.tsx](apps/mobile/components/ui/EmptyState.tsx)** - Uses `Button`, `Host`, `Image`, `Text`, `VStack`, modifiers ✅ **Best practice example**
4. **[FeedComposer.tsx](apps/mobile/components/feed/FeedComposer.tsx)** - Uses `Button`, `Host`, modifiers
5. **Layout files** - 5 additional files using modifiers for styling

### Current Custom Mobile UI Components

Located in [apps/mobile/components/ui/](apps/mobile/components/ui/):
- **BlurSurface.tsx** - Wraps `expo-blur` with semantic tint levels
- **EmptyState.tsx** - Already leverages Expo SwiftUI ✅
- **Form.tsx** - Basic wrapper around `react-native` View
- **PageHeader.tsx** - Custom header component
- **icon.tsx** - Icon utility

---

## Migration Analysis: What Can Be Removed/Simplified

### ❌ Cannot Migrate (Web-Only Patterns)

The vast majority of `packages/platform/ui/src/components` are **web-only** and have no mobile equivalent:

| Component | Type | Why Not Migratable |
|-----------|------|-------------------|
| **Accordion** | Layout | Web dialog pattern, no SwiftUI equivalent |
| **AlertDialog** | Modal | Web-only, not needed (use native alerts) |
| **Calendar** | Input | Complex web widget; mobile needs native picker |
| **Carousel** | Layout | Web scroll pattern; not core to mobile |
| **Command** | Input | CLI-like search; not a mobile pattern |
| **Dropdown/Menu** | Navigation | Web pattern; use Expo's `Menu`/`ContextMenu` instead |
| **Dialog/Drawer** | Modal | Web pattern; use native sheets |
| **Hover-card** | Interaction | Web-only (no hover on touch) |
| **Navigation-menu** | Layout | Web-specific navigation |
| **Popover** | Overlay | Web-specific positioning |
| **Scroll-area** | Layout | Web scroll control; native scrolls naturally |
| **Sidebar** | Layout | Web layout; not mobile pattern |
| **Skeleton** | Loading | Web placeholder; native has different approaches |
| **Tabs** | Navigation | Web pattern; use native tab bars instead |
| **Toast/Toaster** | Notifications | Web pattern; use native alerts/toasts |
| **Tooltip** | Help UI | No touch equivalent |
| **Update-guard** | Modal | Web-specific |

### ✅ Can Be Simplified/Standardized

These have close mobile equivalents but could be **standardized** to Expo SwiftUI:

| Current | Expo SwiftUI Alternative | Action |
|---------|--------------------------|--------|
| **Button** (web) | `Button` from @expo/ui/swift-ui | Already partially migrated; ensure all use Expo SwiftUI |
| **Form** (mobile wrapper) | `Form` from @expo/ui/swift-ui | Standardize to Expo's Form component |
| **Slider** (web/Radix) | `Slider` from @expo/ui/swift-ui | Consider native if mobile needs adjustments |
| **Switch** (web/Radix) | `Toggle` from @expo/ui/swift-ui | Can migrate mobile Toggle to Expo's Toggle |
| **Progress** (web/Radix) | `LinearProgress`/`CircularProgress` | Migrate if mobile uses progress indicators |
| **Input** (web/React) | Mobile uses `react-native`; consider Expo text field modifiers | No direct equivalent; stick with RN |
| **Alert** (web) | Use native iOS alerts (already done) | Already correct |

### 📋 Custom Components Opportunity

These mobile-specific wrappers could be **eliminated or standardized**:

| Component | Current | Recommendation |
|-----------|---------|-----------------|
| **[BlurSurface.tsx](apps/mobile/components/ui/BlurSurface.tsx)** | Wraps `expo-blur` | Keep - good design system wrapper for tint levels |
| **[Form.tsx](apps/mobile/components/ui/Form.tsx)** | Simple RN View wrapper | Migrate to Expo `Form` component + styleable |
| **[PageHeader.tsx](apps/mobile/components/ui/PageHeader.tsx)** | Custom header layout | Replace with Expo `VStack`/`HStack`; add if UI spec requires |
| **[EmptyState.tsx](apps/mobile/components/ui/EmptyState.tsx)** | Already uses Expo SwiftUI | ✅ Keep as template; good design pattern |

---

## Concrete Migration Steps

### Phase 1: Replace Form Component (Quick Win)
**File:** [apps/mobile/components/ui/Form.tsx](apps/mobile/components/ui/Form.tsx)

```tsx
// Current
<View style={[styles.form, style]} {...props} />

// Replace with
<Form modifiers={[frame({ gap: t.spacing.m_16 })]} {...props} />
```

**Benefit:** Leverage native iOS form semantics, better keyboard handling.

---

### Phase 2: Standardize Button Usage
**Files:** 8+ files using `Button`

Already mostly done. Ensure all uses follow the pattern in [EmptyState.tsx](apps/mobile/components/ui/EmptyState.tsx):

```tsx
<Button 
  label={text}
  onPress={handler}
  modifiers={[buttonStyle('bordered')]}
/>
```

---

### Phase 3: Reduce Custom Wrappers
**File:** [apps/mobile/components/ui/PageHeader.tsx](apps/mobile/components/ui/PageHeader.tsx)

Consider replacing custom layouts with Expo components:
```tsx
<VStack spacing={spacing.m} modifiers={[frame({ maxWidth: '100%' })]}>
  {/* content */}
</VStack>
```

---

### Phase 4: Add Progress Indicators (If Used)
If mobile uses progress anywhere, standardize to Expo:

```tsx
import { CircularProgress, LinearProgress } from '@expo/ui/swift-ui';

// Instead of custom implementations
<LinearProgress value={percentage} />
```

---

## What NOT to Migrate

### Platform UI Package (117 components)
❌ Do **not** try to make `packages/platform/ui` cross-platform. It's correctly designed as **web-only**.
- These components depend on web-only libraries (Radix UI, Tailwind, Floating UI)
- Mobile uses completely different interaction paradigms (touch vs mouse, native nav vs web nav)
- Expo SwiftUI handles iOS paradigms correctly

### Keep Separate
- ✅ `packages/platform/ui` → Web (React Router, Tailwind)
- ✅ `apps/mobile` → Native iOS (Expo + React Native)
- ✅ Shared logic/types in `packages/` (if needed)

---

## iOS Native Code (Beyond Expo)

You have native Swift code for:
- **[ControlWidget.swift](apps/mobile/targets/control-center/ControlCenterIntents.swift)** - iOS control center widget
- **[HakumiIntentsModule.swift](apps/mobile/modules/hakumi-intents/ios/HakumiIntentsModule.swift)** - Custom Expo module for intents

These don't conflict with Expo SwiftUI; they're **extension modules** that complement the React Native layer.

---

## Recommendations Summary

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **High** | Standardize all Button usage to Expo SwiftUI pattern | 1-2h | Consistency, better maintainability |
| **Medium** | Replace Form wrapper with Expo Form component | 30m | Better iOS semantics |
| **Medium** | Add CircularProgress/LinearProgress if used | 1h | Eliminate custom progress implementations |
| **Low** | Evaluate PageHeader for Expo component replacement | 1-2h | Code reduction |
| **Don't Do** | Try to port 117 web components to mobile | ❌ | Wrong architecture; already correct |
| **Don't Do** | Make platform/ui cross-platform | ❌ | Web and mobile are fundamentally different |

---

## Conclusion

Your architecture is **already sound**:
- ✅ Web components in `packages/platform/ui` (web-focused, no bloat)
- ✅ Mobile components in `apps/mobile/components` (native iOS focused)
- ✅ Already using Expo SwiftUI for native components

**Optimization opportunities** are **refinements**, not rebuilds:
1. Replace simple custom wrappers with native Expo components
2. Ensure consistent usage patterns across mobile components
3. Leverage more Expo SwiftUI primitives for better iOS integration

The 117 web components can remain as-is; they serve their purpose for the web app and have zero impact on your mobile build size or performance.

---

## Related Files
- Expo SwiftUI Modifiers: `@expo/ui/swift-ui/modifiers`
- Mobile Components: [apps/mobile/components/](apps/mobile/components/)
- Platform UI: [packages/platform/ui/src/components/](packages/platform/ui/src/components/)
- Best Practice Example: [apps/mobile/components/ui/EmptyState.tsx](apps/mobile/components/ui/EmptyState.tsx)
