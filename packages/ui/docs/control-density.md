# Component Sizing System — Design System Specification

> **Status:** Pre-implementation. This document is the source of truth for all component sizing
> decisions across the entire UI package. No height, padding, icon size, spacing value, or
> typographic measurement may be added to a component primitive without being
> traceable to this document. When this document and code disagree, update the code.

---

## 0. Scope and Philosophy

This document defines sizing for **every visible component** in the UI package: controls
(inputs, buttons, selects), navigation chrome (tabs, breadcrumbs), typography (headings, body
text), surfaces (cards, dialogs), and spacing. It does not cover color, shadows, or animation
timing — those belong in separate documents that reference this one.

### 0.1 Why this document exists

The UI package currently has no shared definition of what "a control" is, how tall it should be,
what padding it carries, how large icons should be, or how spacing relates to component sizing.
Each component encodes its own sizing from scratch. The result is multiple competing size systems
running simultaneously in the same package.

This is not a Tailwind problem or a shadcn problem. It is a missing source of truth and a
missing conceptual model. This document establishes both before a single class is changed.

### 0.2 The sizing hierarchy

All sizing in this system derives from **two foundation layers:**

1. **Spacing scale** — the atomic unit (4px) that cascades into all measurements
2. **Typography scale** — how text height and line-height establish vertical rhythm

Every component (controls, surfaces, navigation) must align to these two foundations. When they
conflict, the foundation wins.

```
Spacing scale (4px atomic unit)
        ↓
Typography scale (line-height = 24px unit)
        ↓
Control sizing (inherits both)
        ↓
Navigation sizing, Surface sizing, etc. (all inherit)
```

### 0.3 Design system sources

This system follows guidelines established by:
- **Material Design (Google)** — component sizing model and touch target accessibility
- **Atlassian Design System** — density modes and semantic token hierarchy
- **IBM Carbon** — token naming and composite token patterns
- **WCAG 2.1 Level AA** — minimum interactive target sizes (44×44px recommended)

---

## 1. The Invariants

These rules are unconditional. If a proposed change violates one, the change is wrong — not the rule.

### Structural invariants

1. **Foundations first.** All sizing must align to the spacing scale (4px multiples) and
   typography scale (24px line-height). If a proposed component size doesn't divide evenly by
   4, it is wrong.

2. **One source per size.** A component's sizing derives from exactly one place: either a size
   class (`.control-md`), a discrete token (`--space-4`), or a typography token
   (`--text-base`). Never hardcode multiple utilities that do the same job.

3. **Family alignment.** Every member of a sizing family (Family 1, Family 2, etc.) must follow
   the same sizing logic. If one component in Family 1 uses `control-md`, they all must. If one
   needs to differ, document it as an exception in §6.

### Horizontal and vertical alignment

4. **Row alignment is non-negotiable (Family 1 only).** Every Form Field Control (Family 1) in
   a shared horizontal row must occupy the same height. An icon button next to an input that is
   4 px shorter is a bug, not a design decision.

5. **Vertical rhythm.** Multi-line controls (Family 4) have minimum heights that are multiples
   of 24px (the line-height unit). Single lines are 24px, double is 48px, triple is 72px.

### Component variants

6. **Variant scope per family.** Form Field Controls (Family 1) expose two sizes: `sm` (32px)
   and `md` (36px). Navigation Chrome (Family 2) may have its own variants. But there is no
   `xs`, no `lg` on Family 1 primitives — size diversity belongs in the exception register, not
   in the API.

   Exception: `Button` has a `lg` variant (44px) because it serves multiple purposes. But
   `Button lg` is only used in specific contexts (primary CTAs, primary navigation). It does
   NOT appear mixed with `md` on the same row.

### Accessibility and mobile

7. **Mobile font size ≥ 16 px for text inputs.** iOS zooms the viewport when a focused input
   has `font-size < 16px`. The canonical responsive text class is `text-base md:text-sm`.
   Never flatten this to `text-sm` everywhere.

8. **Touch target minimum (WCAG 4.5.3).** Interactive elements must have a minimum target size
   of 44×44px (iOS) or 48×48px (Material Design). Form Field Controls at `control-md` are
   36×36px (icon buttons) and 36px tall (text controls). This is below the guidance. Document
   this compromise and ensure controls are not clustered so tightly that users misclick.

### Token discipline

9. **Tokens, not magic numbers.** CSS custom properties (§3) are the single source for every
   height, padding, and spacing value. Tailwind's `h-9` is fine as the *expression* of a token
   in a class string — it is not fine as the *definition* of the token.

10. **Exceptions are documented before they ship.** Any component that departs from family
    sizing rules must appear in §6 (Exception Register) with a rationale. An undocumented
    deviation is a tech debt bug waiting to compound.

---

## 1.5 Foundation Layers — Spacing and Typography

All component sizing is built on two immovable foundations. If a component doesn't align to these,
it is a bug, not a design decision.

### 1.5.1 Spacing scale (4px atomic unit)

The spacing scale is **4px increments**. This is the fundamental quantum of measurement.

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-1-5: 0.375rem; /* 6px */
  --space-2: 0.5rem;    /* 8px */
  --space-2-5: 0.625rem; /* 10px */
  --space-3: 0.75rem;   /* 12px */
  --space-3-5: 0.875rem; /* 14px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
}
```

**Every control padding, spacing value, and margin must be a multiple of 4px.** No 7px, no 13px,
no 18px. Deviations break alignment.

Tailwind mapping: `space-1` = `p-1` = 4px, `space-3` = `p-3` = 12px, etc.

### 1.5.2 Typography scale (24px line-height unit)

The vertical rhythm baseline is **24px line-height**. This cascades into all component height
calculations.

```css
:root {
  /* Text sizes and their line heights */
  --text-xs: 0.75rem;    /* 12px */
  --text-xs-lh: 1rem;    /* 16px line-height */

  --text-sm: 0.875rem;   /* 14px */
  --text-sm-lh: 1.5rem;  /* 24px line-height */

  --text-base: 1rem;     /* 16px */
  --text-base-lh: 1.5rem; /* 24px line-height */

  --text-lg: 1.125rem;   /* 18px */
  --text-lg-lh: 1.75rem; /* 28px line-height */

  --text-xl: 1.25rem;    /* 20px */
  --text-xl-lh: 2rem;    /* 32px line-height */

  /* Heading sizes */
  --heading-h1: 2rem;    /* 32px */
  --heading-h1-lh: 2.5rem; /* 40px line-height */

  --heading-h2: 1.5rem;  /* 24px */
  --heading-h2-lh: 2rem; /* 32px line-height */

  --heading-h3: 1.25rem; /* 20px */
  --heading-h3-lh: 1.75rem; /* 28px line-height */
}
```

**The rule:** Single-line controls (inputs, buttons, selects) have heights that are multiples of
24px (or occasionally 20px for compact variants). Multi-line controls (textareas) have minimum
heights that are multiples of 24px.

This ensures text never crowds vertically inside a control.

### 1.5.3 How foundations cascade into control sizing

A control's height is calculated as:

```
Control height = padding-top + content-height + padding-bottom
Content height = max(icon-size, text-size + line-height adjustment)
```

For the canonical `control-md`:
- Line height is 24px (from typography scale)
- Text size is 16px (base)
- Padding is 12px top + 12px bottom (from spacing scale)
- **Total: 12 + 16 + 12 = 40px... but we use 36px because the 24px line-height gives us breathing room**

Actually, the math is: 12 (pad) + 12 (text with internal leading) = 24 per line. Add vertical padding
for breathing: 36px = 12px (pad) + 12px (text/baseline space) + 12px (pad).

The key: **align to the 4px grid, but validate against the 24px rhythm.**

---

## 2. Component Taxonomy and Sizing Families

Components are organized into **sizing families**. All members of a family follow the same sizing
rules. Families may have multiple size variants, but those variants follow a consistent pattern.

### Family 1 — Form Field Controls (Category A)

Single-line, fixed-height controls that accept user input, trigger a selection, or validate entry.
**Must align vertically when placed in the same row.** Sizes: `sm` (32px), `md` (36px, default).

| Component | File | Primary size |
|---|---|---|
| `Input` | `input.tsx` | `control-md` |
| `SelectTrigger` | `select.tsx` | `control-md` (variant: `sm`) |
| `Button` (text variants) | `button.tsx` | `control-md` (variant: `sm`, `lg`) |
| `Button` (icon variant) | `button.tsx` | `size-9` (36px square) |
| `DatePicker` trigger | `date-picker.tsx` | inherits `Button` |
| `FilterSelect` | `filters/filter-select.tsx` | inherits `SelectTrigger` |
| `CommandInput` wrapper | `command.tsx` | `control-md` |
| `Switch` | `switch.tsx` | `h-[1.15rem]` md / `h-3.5` sm |

### Family 2 — Navigation Chrome (Category B)

Controls that structure navigation or tabs. Visually distinct from form fields. Not required to
align with Family 1 on a shared row. Sizes: `sm`, `md` (default).

| Component | File | Sizing model |
|---|---|---|
| `TabsList` | `tabs.tsx` | Container `h-9`, triggers use internal padding |
| `TabsTrigger` | `tabs.tsx` | `min-h-6 px-3 py-1` (navigation rhythm) |
| `Breadcrumb` items | `breadcrumb.tsx` | text-sm, spacing-driven |
| Pagination controls | future | `control-sm` or nav variant |

### Family 3 — Text and Label Components (Category C)

Fixed-height or content-driven text-based components with minimal interaction. Inherits from
typography scale. **These do not use control-md.**

| Component | File | Sizing |
|---|---|---|
| `Badge` | `badge.tsx` | `px-1.5 py-px text-xs` (inline, no min-height) |
| `Label` | `field.tsx` | `text-sm` via typography |
| `Chip` / Attachment item | `attached-notes-list.tsx` | `min-h-11 px-2.5 py-2` (exception — §6) |
| `Avatar` | `avatar.tsx` | discrete sizes: `size-8`, `size-10`, `size-12` |
| `Progress` | `progress.tsx` | `h-2` (data visualization, not control) |

### Family 4 — Multi-line Input Controls (Category D)

Variable-height, content-driven controls. Share horizontal padding with Family 1 but vertical
model is content-dependent. Minimum heights align to 24px rhythm.

| Component | File | Min-height | Padding |
|---|---|---|---|
| `Textarea` | `textarea.tsx` | `min-h-16` (64px) | `px-3 py-2` |
| `PromptInputTextarea` | `composer/prompt-input.tsx` | `min-h-11` (44px) | `px-4 py-3` (exception — §6) |
| `ComposerInput` | `composer/composer.tsx` | `min-h-12` (48px) | `p-0` (exception — §6) |

### Family 5 — Special-Context Controls (Category E)

Controls with intentionally non-standard sizing for accessibility, branding, or specific UX
context. Each has a documented exception entry in §6.

| Component | File | Sizing | Rationale |
|---|---|---|---|
| `OtpCodeInput` | `auth/otp-code-input.tsx` | `min-h-12 px-3.5 py-3` | Elevated touch target for security-critical field |
| Composer attachment chips | `composer/` | `min-h-11` | Pending design decision — §6 |

### Family 6 — Surface and Container Components (Category F)

Boxes that contain other components. Sizing is spacing-driven, not control-driven. Padding
follows the spacing scale; height is content-derived.

| Component | File | Rules |
|---|---|---|
| `Card` | `card.tsx` | padding: `space-4` (16px) to `space-6` (24px) |
| `Dialog` | `dialog.tsx` | padding: spacing scale; min-width: never smaller than 280px |
| `AlertDialog` | `alert-dialog.tsx` | inherits Dialog rules |
| `ComposerShell` | `composer/composer-shell.tsx` | `px-2.5 py-2` + `sm:px-3 sm:py-2.5` responsive padding |

### Family 7 — Icon Components (Category G)

Discrete, square icons used standalone or within other components. **Icons are never stretched
to fill containers; containers are sized to fit icons.**

| Component | File | Sizes available |
|---|---|---|
| Icons (lucide) | via `className` | 12px, 16px, 20px, 24px, 32px (via `size-*` utilities) |
| Icon inside button | `button.tsx` | inherits button variant (8px sm, 12px md) |
| Icon inside input | `input.tsx` | 16px (matches text baseline) |

---

## 3. Density Tiers as First-Class Tokens

The foundation of this system is **density tiers, not individual property tokens**. A density
tier bundles height, padding, font size, and line height into a single coherent unit. When you
pick a tier, you get all the values together — they never drift from each other because they are
defined as a unit.

### 3.1 CSS Variables — Tier definitions

These variables are defined in the global CSS and never used individually. They exist so the
tier definitions below can be checked against a single source of truth.

```css
/* Global tier metrics — source of truth */
:root {
  --tier-sm-height: 2rem;           /* 32px */
  --tier-sm-padding-x: 0.5rem;      /* 8px */
  --tier-sm-font-size: 0.75rem;     /* 12px */
  --tier-sm-line-height: 1rem;      /* 16px */

  --tier-md-height: 2.25rem;        /* 36px */
  --tier-md-padding-x: 0.75rem;     /* 12px */
  --tier-md-font-size: 1rem;        /* 16px mobile, 14px on md: breakpoint */
  --tier-md-line-height: 1.5rem;    /* 24px */

  --tier-lg-height: 2.75rem;        /* 44px — documented exceptions only */
  --tier-lg-padding-x: 1rem;        /* 16px */
  --tier-lg-font-size: 1rem;        /* 16px */
  --tier-lg-line-height: 1.5rem;    /* 24px */

  /* Shared across all tiers */
  --tier-radius: var(--radius-md);
  --tier-border-width: 1px;
}
```

### 3.2 Utility Classes — How components use sizes

Instead of picking individual Tailwind utilities, components apply a **control size class** that
encodes the entire visual signature at once.

```css
/* Custom Tailwind layer — add to tailwind.config or a @layer rule */

@layer components {
  .control-sm {
    @apply h-8 px-2 text-xs;
    line-height: var(--tier-sm-line-height);
  }

  .control-md {
    @apply h-9 px-3 text-base md:text-sm;
    line-height: var(--tier-md-line-height);
  }

  .control-lg {
    @apply h-11 px-4 text-base;
    line-height: var(--tier-lg-line-height);
  }

  /* Shared across all interactive controls */
  .control-base {
    @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
           border border-input bg-transparent transition-[color,box-shadow]
           outline-none disabled:pointer-events-none disabled:opacity-50
           focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50;
  }

  .control-invalid {
    @apply aria-invalid:ring-destructive/20 aria-invalid:border-destructive;
  }
}
```

### 3.3 How components reference sizes

A component does not write out `h-9 px-3 text-base md:text-sm`. It delegates to the size class:

```tsx
function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'control-base control-md control-invalid',
        className,
      )}
      {...props}
    />
  );
}
```

When the size metrics change (e.g., the design system evolves and `--tier-md-height` becomes
`2.5rem`), every component using `control-md` updates automatically. No sync required, no
drift possible.

### 3.4 Responsive behavior

Only the size class definition can contain media queries. Individual components never write
`md:text-sm` or breakpoint-dependent overrides. If a component needs a different size at a
breakpoint, it's a documented exception in §6.

```css
@layer components {
  .control-md {
    @apply h-9 px-3 text-base;      /* mobile default: 16px */
  }
  
  @media (min-width: 768px) {
    .control-md {
      @apply text-sm;               /* desktop: 14px to reclaim space */
    }
  }
}
```

### 3.5 Shared styling — Focus ring and invalid state

All interactive controls inherit focus and invalid styling from the `.control-base` and
`.control-invalid` layers. Components do not redefine these.

**No component may write:**
```tsx
/* ❌ Wrong */
focus-visible:border-ring focus-visible:ring-[3px]
aria-invalid:ring-destructive/20
```

**Every component must include:**
```tsx
/* ✓ Right */
className={cn('control-base control-md control-invalid', className)}
```

---

## 4. Responsive Behavior and Breakpoint Rules

All sizing must be intentional about how it changes across breakpoints. **Responsive sizing is
not about making things smaller for mobile — it is about optimizing density for the context.**

### 4.1 Mobile-first principle

Design sizes for mobile (320px viewport) first. Then, specify overrides at the `sm` (640px),
`md` (768px), and `lg` (1024px) breakpoints only if the design explicitly requires it.

Default: no breakpoint changes. The mobile size is the canonical size. Overrides are exceptions.

### 4.2 Text sizing across breakpoints

The only text sizing change permitted in component layers is:
```css
@apply text-base md:text-sm;
```

This reflects that:
- Mobile needs 16px for touch accessibility and iOS non-zoom
- Desktop can use 14px to reclaim horizontal space
- No other text size changes are permitted in component classes

Other text (headings, body copy) is controlled by the typography system, not component layers.

### 4.3 Space and padding across breakpoints

Containers (Family 6) may adjust padding across breakpoints:

```css
@apply px-2.5 py-2;     /* mobile */
@media (min-width: 768px) {
  @apply px-3 py-2.5;   /* tablet and up */
}
```

But **form controls (Family 1) do not change padding across breakpoints**. A `control-md` input
is always 36px and `px-3`, on mobile or desktop.

### 4.4 Icon sizing in controls

Icons inherit the `size-*` class from their parent control:
- Family 1 controls: icon inside is 16px (matches baseline text)
- Family 1 icon buttons: icon inside is 16px; button is `size-9` (36px)
- Family 2 navigation: icon inside is 16px
- Family 3 text/badges: icon is 12px (small) or 16px (regular)

**Icons are never responsive.** If icon sizes need to change across breakpoints, the entire
component size changes (not just the icon).

---

### 5.1 Family 1 — Form Field Controls

All Family 1 controls use the `.control-base`, `.control-*`, and `.control-invalid` layers:

#### Default size: `control-md`

```tsx
<Input className={cn('control-base control-md control-invalid')} />
<SelectTrigger className={cn('control-base control-md control-invalid')} />
<Button className={cn('control-base control-md')} />
```

Provides: 36px height, 12px horizontal padding, 16px mobile / 14px desktop text, shared
focus/invalid styling.

**Why md is default:** 36px is adequate for touch targets (though below the 44px recommendation);
it's the visual weight standard for primary form interactions; it maximizes mobile screen space
without cramping.

#### Compact size: `control-sm`

Use only in explicitly dense contexts (data tables, inline filter bars) where no mixing with
`control-md` occurs on the same row.

```tsx
<SelectTrigger
  className={cn('control-base control-sm control-invalid')}
  size="sm"
/>
```

Provides: 32px height, 8px horizontal padding, 12px text.

#### Icon buttons within Family 1

Icon buttons are square at each size:
- `control-md` → `size-9` (36×36px)
- `control-sm` → `size-8` (32×32px)

**Current bug:** `Button size="icon"` defaults to `size-8`. Fix: change icon variant to `size-9`
so icon buttons align with text input height.

### 5.2 Family 2 — Navigation Chrome

Navigation elements (tabs, breadcrumbs) are visually and semantically distinct from form controls.
They do not inherit from `control-*` sizes.

```tsx
<TabsList className="nav-md">
  <TabsTrigger className="nav-trigger-md">Tab</TabsTrigger>
</TabsList>
```

Current sizing: `TabsList` is `h-9`; `TabsTrigger` is `min-h-6 px-3 py-1`. These are
intentional and correct. No changes required.

### 5.3 Family 3 — Text and Label Components

Text-based components (badges, labels, chips) inherit from the typography scale, not control
sizing.

```tsx
<Badge className="px-1.5 py-px text-xs" />          /* inline, no min-height */
<Label className="text-sm font-medium" />           /* from typography */
<Avatar className="size-10" />                      /* discrete square sizes */
```

These components do not need to align with Family 1 controls. Their sizing is independent.

### 5.4 Family 4 — Multi-line Input Controls

Textareas and expanding text inputs use minimum heights that align to the 24px line-height
rhythm. Content drives growth beyond the minimum.

```tsx
<textarea className={cn('control-base control-md', 'min-h-16 py-2')} />
```

- Horizontal padding from `control-md` (12px)
- Vertical padding for breathing room (8px top, 8px bottom = 16px total)
- Minimum height as multiple of 24px (single 24px, double 48px, triple 72px)

| Component | Control size | Min-height | V-padding |
|---|---|---|---|
| `Textarea` (general) | `control-md` | `min-h-16` (64px, 2.67 lines) | `py-2` |
| `PromptInputTextarea` (composer) | `control-md` | `min-h-11` (44px, 1.83 lines) | `py-3` (exception §6) |
| `ComposerInput` | none | `min-h-12` (48px, 2 lines) | `p-0` (exception §6) |

### 5.5 Family 5 — Special-Context Controls

Controls with intentionally non-standard sizing. Each must have an entry in §6.

```tsx
<OtpCodeInput className="min-h-12 px-3.5 py-3" />  /* enlarged for security-critical entry */
```

### 5.6 Family 6 — Surface and Container Components

Surfaces (cards, dialogs) use spacing-scale padding and content-driven height. They do not
directly inherit control sizing.

```tsx
<Card className="p-4" />           /* 16px padding from spacing scale */
<Dialog className="p-6" />         /* 24px padding from spacing scale */
```

Padding options: `space-3` (12px), `space-4` (16px), `space-5` (20px), `space-6` (24px).
Choose based on content density and visual hierarchy.

### 5.7 Family 7 — Icon Components

Icons are discrete, square, and never stretched to fill space. They come in discrete sizes:

| Use case | Size | Example |
|---|---|---|
| Inside text (small) | 12px | `size-3` |
| Inside control (baseline) | 16px | `size-4` |
| Standalone icon | 20px or 24px | `size-5`, `size-6` |
| Large decoration | 32px+ | `size-8`, `size-12` |

**Icons never resize responsively.** If the visual hierarchy needs to change across breakpoints,
the entire component (icon + container) resizes together, not just the icon.

---

## 6. Implementation Roadmap

The migration is smaller than it appears because the heavy lifting is **tier utility definition,
not component-by-component rewrites**. Here's the phased approach:

### Phase 1 — Define control size utilities (1 file, ~60 lines)

Create a new file:
`packages/ui/src/styles/control-sizes.css` (or add to `globals.css`)

This file contains:
1. CSS custom properties (§3.1)
2. Tailwind @layer components with `.control-base`, `.control-sm`, `.control-md`, `.control-lg`, `.control-invalid` (§3.2)
3. Navigation control sizes (`.nav-md`, `.nav-trigger-md`) for Category B (§4.4)

Once this file is written and integrated into Tailwind, every component can reference sizes by
name instead of enumerating properties.

### Phase 2 — Fix the two bugs (2 components, 5 minutes)

After tier utilities are defined, these two bugs fix immediately with zero risk:

#### Bug 1: `packages/ui/src/components/button.tsx` — icon size

```diff
  size: {
-   icon: 'size-8',
+   icon: 'size-9',
  },
```

Impact: Icon buttons in existing layouts may grow slightly. Audit and test composites like:
- Composer toolbar buttons
- Card header action buttons
- Filter/search bars with icon buttons

#### Bug 2: `packages/ui/src/components/command.tsx` — inner input height

```diff
- <CommandPrimitive.Input
-   className="... h-10 ... py-3 ..."
+ <CommandPrimitive.Input
+   className="... h-full ..."
```

The wrapper is `h-9`. The inner input was hardcoded `h-10` — larger than its container. Setting
`h-full` lets it respect the parent boundary.

### Phase 3 — Adopt control size utilities (Category A components only)

Once sizes exist, update Category A components to use them. This is mechanical:

```diff
function Input({ className, type, ...props }) {
  return (
    <input
      className={cn(
-       'file:text-foreground placeholder:text-muted-foreground ... h-9 ... px-3 py-1 text-base ... md:text-sm',
+       'control-base control-md control-invalid',
        className,
      )}
      {...props}
    />
  );
}
```

The affected files:
- `input.tsx`
- `select.tsx`
- `button.tsx` (text variants; icon is separate)

This is a find-and-replace at scale, but each file is trivial because the control size utilities
encapsulate all the redundancy.

### Phase 4 — Document exceptions (Category D only)

Update §6 with final decisions on:
- `OtpCodeInput` (almost certainly stays `control-lg`)
- Composer attachment chips (needs explicit design decision)

### No changes required — already correct

The following are already in the right state or are safely out of scope:

| File | Reason |
|---|---|
| `textarea.tsx` | Category C — will add size inheritance once sizes exist |
| `tabs.tsx` | Category B — own navigation size system, no sync issues |
| `field.tsx` | Layout wrapper — no control geometry |
| `text-field.tsx` | Passes through to Input |
| `date-picker.tsx` | Inherits Button |
| All composed wrappers | Inherit from base components |

---

## 7. Exception Register

Every Family 5 component and every deviation from family sizing rules must have a row here.
An exception without a row is a bug.

| Component | Family | Canonical | Actual | Rationale | Reviewed |
|---|---|---|---|---|---|
| `OtpCodeInput` | 4 | `control-md` 36px | `min-h-12` 48px | One-time code entry requires a large, unambiguous touch target. The oversized height creates visual weight that communicates the security-critical nature of the field. | — |
| `PromptInputTextarea` | 4 | `min-h-16` 64px | `min-h-11` 44px | Composer textarea starts at a single visible row, acting more like an input than a traditional textarea. Content drives growth. `min-h-11` gives enough breathing room for single-row start state. | — |
| `ComposerInput` | 4 | `px-3` horizontal | `p-0` | Padding is provided by the `ComposerShell` container, not the textarea itself. Prevents double-padding while maintaining form alignment. | — |
| Composer attachment chips | 3 | typography-based | `min-h-11` 44px | **Decision pending.** Likely correct as exception for floating-surface touch ergonomics. Needs explicit design sign-off. | — |

---

## 8. Checklist for New Component Development

Before writing the first line of a new interactive component:

1. **Assign a family** (1–7) from §2.
2. **If Family 1 (Form Field Control):** apply `.control-md` or `.control-sm` size classes
   from §5.1. Do not invent new sizes. Reference §3 for token definitions.
3. **If Family 2–5:** reference §5.2–5.5 for sizing guidelines for your family. If non-standard,
   write an exception row in §7 first and get design sign-off.
4. **For all responsive behavior:** follow §4 rules — mobile-first, text only changes at `md:`
   breakpoint, no responsive padding/height changes in controls.
5. **Use `data-slot` and `data-size`** attributes so sizing can be inspected in DevTools
   without reading source.
6. **Test alignment:** if the component is Family 1, verify it aligns with adjacent controls
   on the same row.
7. **Document in codebase:** add the component to the appropriate Family table in §2 once
   the component is audited and in use.

---

## 9. Relationship to the Broader Design System

This document governs **all component sizing** — form controls, navigation, surfaces, spacing,
icons, and typography as it relates to sizing. The following concerns are out of scope here and
belong in separate specialized documents:

- **Color system** — semantic color roles, color tokens, theme variables
- **Elevation system** — shadows, z-index stacking context, layering rules
- **Typography system** (future, cross-references this doc) — font families, font weights,
  line-height ratios, text transformation rules (not sizing, which is here)
- **Animation system** (future) — transition timing, easing functions, motion principles
- **Responsive breakpoints** (defined here in §4) — custom breakpoint values if different
  from Tailwind's defaults
- **Density modes** (future, if adopted) — how sizing scales change in compact/spacious modes

### 9.1 How this document connects

When other design system documents are written:

- **Typography document** should reference §1.5.2 for vertical rhythm and how text
  line-height cascades into component heights
- **Color document** should link here for how controls inherit focus ring color from this
  specification
- **Responsive strategy document** should link to §4 for breakpoint rules specific to component
  sizing
- **Icon system document** should link to §5.7 for how icon sizing relates to component sizing

This is the foundation. Other documents build on top of it.

---

## 10. Quick Reference — Component Sizes at a Glance

| Component | Family | Default size | Variants | Height |
|---|---|---|---|---|
| `Input` | 1 | `control-md` | `control-sm` | 36px (md), 32px (sm) |
| `SelectTrigger` | 1 | `control-md` | `control-sm` | 36px (md), 32px (sm) |
| `Button` (text) | 1 | `control-md` | `sm`, `lg` | 36px (md), 32px (sm), 44px (lg) |
| `Button` (icon) | 1 | `size-9` | `size-8` | 36px (md), 32px (sm) |
| `TextField` | 1 | inherits `Input` | — | 36px |
| `DatePicker` trigger | 1 | inherits `Button` | — | 36px |
| `FilterSelect` | 1 | inherits `SelectTrigger` | — | 36px |
| `Tabs.List` | 2 | nav sizing | — | 36px |
| `Tabs.Trigger` | 2 | nav sizing | — | min 24px |
| `Badge` | 3 | typography-based | — | auto (text-driven) |
| `Avatar` | 3 | discrete | 8, 10, 12px | varies |
| `Textarea` | 4 | `control-md` + `min-h-16` | — | min 64px |
| `PromptInputTextarea` | 4 | `control-md` + `min-h-11` | — | min 44px (exception) |
| `OtpCodeInput` | 5 | — | — | min 48px (exception) |
| `Card` | 6 | spacing-based | — | content-driven |
| `Dialog` | 6 | spacing-based | — | content-driven |
| Icons (lucide) | 7 | discrete | 12, 16, 20, 24, 32px | varies |

### Quick rules

- **Family 1 (Form Controls):** Always use `.control-base`, `.control-md` (or `.control-sm`),
  and `.control-invalid` classes
- **Family 2–3:** Use component-specific sizing; do not use `.control-*` classes
- **Family 4 (Textareas):** Use `.control-base` + `.control-md` + additional min-height class
- **Family 5–6:** Spacing-driven; use `space-*` utilities from spacing scale
- **Family 7 (Icons):** Use discrete `size-*` values; never responsive; never stretch

### Before shipping a new component

- [ ] Does it fit one of the seven families in §2?
- [ ] Do the pixel dimensions align to 4px grid (§1.5.1)?
- [ ] Do heights align to 24px rhythm (§1.5.2)?
- [ ] If Family 1: does it use `.control-*` size classes?
- [ ] If non-standard sizing: is there an entry in §7 (Exception Register)?
- [ ] Are text sizes `text-base md:text-sm` (not just `text-sm`)?
- [ ] Does it pass alignment tests with adjacent controls on same row?
