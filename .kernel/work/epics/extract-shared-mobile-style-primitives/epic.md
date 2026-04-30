# Thoroughly refactor shared design-system primitives

## Summary

Expand the shared design-token layer so the most reused typography, spacing, radii, and sizing values are defined once and consumed consistently across web and mobile, with a compact `sm/md/lg/xl` scale and CSS-owned presentation on web.

## Context

This epic sits under the token-first style-system goal. The apps already have token and theme layers, but components still repeat raw numbers for many common values, and some web presentation is still expressed through JavaScript rather than CSS. The work here is to move the recurring design values into a shared token system, then migrate each platform onto the right consumption path.

## Acceptance Criteria

- [ ] The shared token layer exposes the common typography, spacing, radii, and sizing values needed by the apps, with each shared scale limited to four steps or fewer.
- [ ] Mobile shared components and high-traffic screens consume tokens through the theme instead of repeating raw style values for shared patterns.
- [ ] Web shared components consume tokens through CSS variables or CSS-native definitions instead of JavaScript-defined presentation values.
- [ ] The token names are stable enough that different components can reuse them without needing per-screen overrides.

## Plan

1. Inventory the reused values currently hard-coded in mobile and currently defined through JavaScript presentation logic on web.
2. Extend the shared token definitions only where the reuse justifies a named token, and keep each scale compact.
3. Migrate web shared components to CSS-backed token consumption first where JavaScript is only carrying presentation values.
4. Migrate mobile shared components and high-visibility screens onto the same token vocabulary through the theme.
5. Validate the changed surfaces against the current design before expanding the migration.

## Tasks

- `refactor-shared-mobile-screen-styles`

## Linked Knowledge

- None yet

## Journal

- 2026-04-30T18:00:05.768Z: Created epic `extract-shared-mobile-style-primitives`.
- 2026-04-30T18:07:53Z: Reframed as shared theme-token expansion for mobile typography, spacing, radii, and sizing.
- 2026-04-30T18:16:00Z: Constrained shared scales to `sm/md/lg/xl`.
- 2026-04-30T18:32:00Z: Expanded the epic to include CSS-backed token consumption on web and removal of JavaScript-defined presentation styles from web components.
- 2026-04-30T18:44:00Z: Renamed the epic to reflect the broader refactor of shared design-system primitives instead of a narrower token-expansion effort.
