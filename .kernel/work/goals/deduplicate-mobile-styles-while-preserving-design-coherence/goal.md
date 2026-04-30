# Thoroughly refactor the cross-platform design system

## Summary

Establish a token-first cross-platform design system where typography, spacing, radii, and related sizing values are defined once, then consumed through platform-appropriate styling: CSS-backed tokens on web and theme-backed tokens on mobile, with each shared scale kept to a small `sm/md/lg/xl` set.

## Context

The current apps repeat raw numeric values and ad hoc style fragments across components and screens. On mobile, that shows up as inline React Native style literals. On web, some presentation values are still defined through JavaScript token access rather than being owned by CSS. That makes spacing, typography, and sizing drift over time, even when the UI intent is meant to be the same. The better pattern is to define the design vocabulary once, keep the shared scales deliberately small, and let each platform consume those tokens through its native styling layer.

## Success Criteria

- [ ] Shared tokens cover the common typography, spacing, radii, and related sizing values used across web and mobile, with no more than four steps per shared scale.
- [ ] Mobile components and screens consume those tokens through the theme instead of repeating raw style numbers where the intent is shared.
- [ ] Web components consume the same design vocabulary through CSS variables or CSS-native tokens instead of defining presentation values in JavaScript.
- [ ] Shared reusable primitives stay visually aligned across contexts without per-component token drift.
- [ ] Visual regression risk stays low: the migration is validated against the current mobile and web UI, not just compile-time checks.

## Plan

1. Audit the shared design values that are still hard-coded in mobile components or expressed through JavaScript styling on web: typography sizes and weights, spacing, radii, icon sizes, control heights, and common container dimensions.
2. Expand the shared token set only where the value is reused enough to justify a named token, keeping each scale small and coherent.
3. Keep web presentation owned by CSS:
   move reusable design values into CSS variables or CSS-native token definitions
   remove JavaScript-defined presentation values from web components unless the value is inherently behavioral
4. Keep mobile presentation owned by the theme:
   expose the shared tokens through the React Native theme layer
   migrate mobile components and repeated screens from raw literals to token-backed helpers
5. Keep platform-specific exceptions local and explicit so the token layer stays useful rather than becoming a vague catch-all.
6. Add a review guardrail for future work:
   prefer token usage over new literals when a value is already represented in the system
   prefer CSS token consumption over JavaScript styling for web presentation
   flag new ad hoc sizes only when they do not map cleanly to the existing system
7. Validate the migration with targeted screen checks after each batch and update the style inventory as the token set evolves.

## Epics

<!-- Add implementation epics here as they are created. -->

## Linked Knowledge

- None yet

## Journal

- 2026-04-30T17:58:27.289Z: Created goal `deduplicate-mobile-styles-while-preserving-design-coherence`.
- 2026-04-30T18:07:53Z: Rewritten to prioritize token-first theme expansion over shared screen-style extraction.
- 2026-04-30T18:16:00Z: Narrowed the shared scales to `sm/md/lg/xl` to keep the theme vocabulary compact.
- 2026-04-30T18:32:00Z: Expanded the goal to cover CSS-owned web token consumption and removal of JavaScript-defined presentation styles from web components.
- 2026-04-30T18:44:00Z: Renamed the goal to reflect the broader design-system refactor scope across web and mobile.
