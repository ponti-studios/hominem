# Shared UI adoption plan for `apps/career`

## Goal

Adopt the highest-value shared UI primitives from `@hominem/ui` in `apps/career` so we:

- reduce duplicated local UI primitives
- put currently dead shared components into real product use
- improve consistency across Hominem apps
- keep the `apps/career` migration safe by introducing shared UI in phases

## Constraints

- `apps/career` is intentionally self-contained in the first migration pass.
- The app currently does **not** depend on `@hominem/ui`.
- The app currently uses its own local UI primitives and Tailwind utilities.
- The shared UI package expects semantic design tokens (`bg-background`, `text-foreground`, `border-border`, etc.) that are not fully defined in `apps/career/app/app.css`.
- We should not import the full shared dark theme blindly and accidentally restyle the app.

## Recommendation

Adopt shared UI in **three phases**:

1. **Theme bridge** — make `@hominem/ui` components render safely in `apps/career`
2. **High-ROI component adoption** — use shared primitives in the most obvious product surfaces
3. **Form and layout convergence** — replace duplicated local UI where the shared primitives are clearly better

---

## Phase 0 — Theme bridge and package wiring

### Objective

Make it technically safe for `apps/career` to consume shared UI primitives without forcing the whole app onto the Notes app visual theme.

### Changes

#### 1. Add package dependency

Update `apps/career/package.json`:

- add `@hominem/ui: "workspace:*"`

#### 2. Define the semantic token bridge in `apps/career/app/app.css`

Add semantic CSS variables used by shared UI components.

At minimum define:

- `--background`
- `--foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--popover`
- `--popover-foreground`
- `--input`
- `--ring`
- `--border`
- `--sidebar`
- `--sidebar-foreground`
- `--sidebar-accent`
- `--sidebar-accent-foreground`
- `--sidebar-border`
- `--sidebar-ring`

### Token mapping target

Map them to the current Craftd light visual language, not the Notes app dark theme.

Suggested initial mapping:

- `--background`: white / page background
- `--foreground`: slate/gray text
- `--primary`: current blue or black primary action color
- `--muted`: light gray surface
- `--accent`: current hover/accent background
- `--border`: current gray border
- `--popover`: white
- `--ring`: current blue focus ring

### Do not do yet

- do **not** import `packages/platform/ui/src/styles/globals.css` wholesale into `apps/career`
- do **not** replace all local UI primitives at once

### Acceptance criteria

- `apps/career` typechecks with `@hominem/ui` added
- shared UI components can render without broken colors/backgrounds
- existing `apps/career` pages remain visually close to current design

---

## Phase 1 — Highest-value product adoption

## 1. Replace manual tabs in application detail with shared `Tabs`

### Shared components

- `@hominem/ui/tabs`

### Target file

- `apps/career/app/routes/career.applications.$id.tsx`

### Why

This route currently has a custom tab system with local state and manual tab button styling.

### Replace

Current custom tab UI:

- local `activeTab` state
- manual nav row
- manual selected border styles

With:

- `Tabs`
- `TabsList`
- `TabsTrigger`
- `TabsContent`

### Acceptance criteria

- tabs still switch between:
  - Overview
  - Timeline
  - Notes
  - Files
- keyboard tab navigation works
- active tab styling is consistent with shared UI
- no regression in route behavior

---

## 2. Replace the application search input with shared `SearchInput`

### Shared components

- `@hominem/ui/search-input`

### Target file

- `apps/career/app/components/career/ApplicationTable.tsx`

### Why

The applications table already has a search field; this is a direct fit for the shared debounced search input.

### Replace

Current custom search input block with:

- `SearchInput`

Keep existing URL param update behavior.

### Acceptance criteria

- search still updates query params
- debounced behavior works cleanly
- filter results remain correct

---

## 3. Replace raw desktop application table with shared `Table`

### Shared components

- `@hominem/ui/table`

### Target file

- `apps/career/app/components/career/ApplicationTable.tsx`

### Why

This is the clearest current use case for the shared table primitives.

### Replace

Desktop-only section:

- raw `<table>`
- raw `<thead>`, `<tbody>`, `<th>`, `<td>`

With shared primitives:

- `Table`
- `TableHeader`
- `TableBody`
- `TableRow`
- `TableHead`
- `TableCell`

### Keep

- current mobile card list fallback
- current data formatting helpers

### Acceptance criteria

- desktop table layout is unchanged or improved
- hover/focus states remain good
- row links still work
- no regressions in responsive behavior

---

## 4. Replace local avatar with shared `Avatar`

### Shared components

- `@hominem/ui/avatar`

### Target files

- `apps/career/app/components/Navigation.tsx`
- `apps/career/app/components/Avatar.tsx`

### Why

The local avatar only exists to support one current use in navigation. The shared avatar is more capable and avoids duplication.

### Plan

Either:

- delete `apps/career/app/components/Avatar.tsx` and use shared avatar directly in `Navigation.tsx`

or

- keep a tiny adapter component wrapping shared `Avatar`, `AvatarImage`, and `AvatarFallback`

### Acceptance criteria

- authenticated nav still shows user avatar/fallback
- fallback initial still works when image is absent
- hover/layout remains correct

---

## Phase 2 — Filters and form controls

## 5. Migrate application filters to shared filter primitives

### Shared components

- `@hominem/ui/filters`
- `@hominem/ui/select` or shared filter-select export if added
- `@hominem/ui/checkbox`

### Target file

- `apps/career/app/components/career/ApplicationTable.tsx`

### Why

This screen has a real filter surface:

- search
- status multi-select
n- source select

### Proposed shared usage

- `FilterControls` as the outer filter layout
- `FilterSelect` for source
- `Checkbox` for status multi-select rows

### Note

If `FilterSelect` is not yet exported, export it from `@hominem/ui` as part of this phase.

### Acceptance criteria

- status multi-select still supports:
  - select one
  - multiple selected statuses
  - clear all
  - select all
- source filtering still maps to URL params
- filters remain accessible and keyboard-usable

---

## 6. Replace local `Switch` with shared `Switch`

### Shared components

- `@hominem/ui/switch`

### Target file

- `apps/career/app/routes/editor.basic.tsx`

### Why

This is currently the only clear use of the local switch primitive.

### Acceptance criteria

- `availabilityStatus` still updates correctly through React Hook Form `Controller`
- checked/unchecked states remain clear
- keyboard interaction works

---

## 7. Replace raw project/editor checkboxes with shared `Checkbox`

### Shared components

- `@hominem/ui/checkbox`

### Target files

- `apps/career/app/routes/editor.projects.tsx`
- `apps/career/app/routes/career.projects.tsx`
- `apps/career/app/components/career/ApplicationTable.tsx` (status filter)

### Why

The app currently uses raw checkbox inputs in multiple places.

### Acceptance criteria

- existing booleans (`isFeatured`, `isVisible`, filter statuses) still round-trip correctly
- labels remain clickable
- focus and checked states are accessible

---

## 8. Introduce shared `DatePicker` gradually

### Shared components

- `@hominem/ui/date-picker`

### Transitive dead components activated

- `calendar`
- `popover`

### Best first target files

- `apps/career/app/routes/career.applications.create.tsx`
- `apps/career/app/routes/career.certifications.tsx`

### Why these first

They are simpler create flows than the editor routes.

### Migration note

Shared `DatePicker` uses `Date | undefined`, while many current forms use string values. Add a small adapter:

- string -> `Date | undefined` for UI
- selected `Date` -> ISO/local string for form state

### Acceptance criteria

- date values still submit correctly to loaders/actions
- no timezone bugs introduced for date-only fields
- picker works on keyboard and pointer

---

## Phase 3 — Larger structural adoption

## 9. Replace editor side navigation with shared `Sidebar`

### Shared components

- `@hominem/ui/sidebar`

### Transitive dead components activated

- `sheet`
- `tooltip`
- `skeleton`

### Target file

- `apps/career/app/routes/editor.tsx`

### Why

The editor layout is already a sidebar layout. The shared sidebar is a strong conceptual match.

### Use

- `SidebarProvider`
- `Sidebar`
- `SidebarHeader`
- `SidebarContent`
- `SidebarMenu`
- `SidebarMenuItem`
- `SidebarMenuButton`

### Keep

- current editor step definitions
- current route structure
- current `Outlet` layout logic

### Acceptance criteria

- desktop editor navigation works
- mobile navigation works via the shared sheet-backed behavior
- current active route highlighting remains correct

---

## 10. Use `Accordion` for mobile expandable project cards

### Shared components

- `@hominem/ui/accordion`

### Target file

- `apps/career/app/routes/career.projects.tsx`

### Why

`ProjectMobileCard` already implements manual expand/collapse behavior.

### Replace

- local `isExpanded` state per card
- custom chevron rotation behavior

With:

- `Accordion`
- `AccordionItem`
- `AccordionTrigger`
- `AccordionContent`

### Acceptance criteria

- only intended sections expand/collapse
- mobile detail disclosure remains easy to scan
- keyboard accessibility improves

---

## Components to prioritize for export from `@hominem/ui`

If not already exported, expose these for career-app adoption:

- `./tabs`
- `./search-input`
- `./table`
- `./avatar`
- `./switch`
- `./checkbox`
- `./date-picker`
- `./accordion`
- `./filters`
- optionally `./select`
- optionally `./sidebar`

## Components not worth forcing into `apps/career` right now

Do not add usage just to reduce dead code unless product demand appears:

- `carousel`
- `aspect-ratio`
- `menubar`
- `navigation-menu`
- `slider`
- `toggle`
- `toggle-group`
- `number-input`
- `hover-card`
- `context-menu`
- `progress`

## Storybook/data cleanup

The following file should remain Storybook-only unless a real app use appears:

- `packages/platform/ui/src/components/chat/chat-story-data.tsx`

Move it under `src/storybook/**` in a later cleanup pass.

---

## Suggested implementation order

1. Add `@hominem/ui` to `apps/career`
2. Add semantic token bridge in `apps/career/app/app.css`
3. Migrate `career.applications.$id.tsx` to shared `Tabs`
4. Migrate `ApplicationTable.tsx` search to `SearchInput`
5. Migrate `ApplicationTable.tsx` desktop table to shared `Table`
6. Migrate navigation avatar to shared `Avatar`
7. Migrate `ApplicationTable.tsx` filters to shared filter primitives
8. Migrate `editor.basic.tsx` to shared `Switch`
9. Introduce `DatePicker` in create flows
10. Migrate editor layout to shared `Sidebar`
11. Migrate project mobile expanders to `Accordion`

---

## Success metrics

We should consider the migration successful when:

- `apps/career` uses shared UI in at least 4 real product surfaces
- local duplicate primitives begin shrinking or disappearing
- dead-code diagnostics in `packages/platform/ui` drop meaningfully
- career screens remain visually coherent with the existing Craftd product style
- no broad visual regressions are introduced by shared semantic tokens
