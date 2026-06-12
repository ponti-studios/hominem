# Control Density — Design System Specification

> **Status:** Pre-implementation. This document is the source of truth for all control sizing
> decisions. No height or padding value may be added to a component primitive without being
> traceable to this document. When this document and code disagree, update the code.

---

## 0. Why this document exists

The UI package currently has no shared definition of what a "control" is, how tall it should be,
or what padding it carries. Each component encodes its own sizing from scratch. The result is
four competing size systems running simultaneously in the same package.

This is not a Tailwind problem or a shadcn problem. It is a missing source of truth. This
document establishes that source of truth before a single class is changed.

---

## 1. The Invariants

These rules are unconditional. If a proposed change violates one, the change is wrong — not the rule.

1. **One source per size.** A control's height at a given size derives from exactly one
   place: the `.control-sm` / `.control-md` / `.control-lg` class. Never hardcode individual
   height utilities on a control component.

2. **Row alignment is non-negotiable.** Every interactive control in a shared horizontal row
   must occupy the same size. An icon button next to an input that is 4 px shorter is a
   bug, not a design decision.

3. **Padding does not define height for single-line controls.** `py-1` on an `h-9` input is
   vestigial. The `h-9` sets the height; `items-center` centers the content. Remove the
   redundant padding or it will confuse the next developer.

4. **Two sizes per family, never more.** Each control family exposes `default` (`md`) and `sm`. There
   is no `xs`, no `lg`, no `xl` on form-field primitives. Size diversity belongs in the
   exception register, not in the variant API.

5. **Mobile font size ≥ 16 px for text inputs.** iOS zooms the viewport when a focused input
   has `font-size < 16px`. The canonical responsive class is `text-base md:text-sm`. Never
   flatten this to `text-sm` everywhere.

6. **Exceptions are documented before they ship.** Any control that departs from the canonical
   sizes must appear in §6 of this document with a rationale. An undocumented deviation is a
   bug waiting to compound.

7. **Tokens, not magic numbers.** CSS custom properties (§3) are the single source for every
   height and padding value. Tailwind's `h-9` is fine as the *expression* of a token in a class
   string — it is not fine as the *definition* of the token.

---

## 2. Control Taxonomy

Every interactive control in this package belongs to exactly one category. Category membership
determines which geometry rules apply.

### Category A — Form Field Controls

Single-line, fixed-height controls that accept user input, trigger a selection, or act as a
primary call-to-action. **Must align vertically when placed in the same row.**

| Component | File |
|---|---|
| `Input` | `input.tsx` |
| `SelectTrigger` | `select.tsx` |
| `Button` (text variants) | `button.tsx` |
| `Button` (icon variant) | `button.tsx` |
| `DatePicker` trigger | `date-picker.tsx` (inherits Button) |
| `FilterSelect` | `filters/filter-select.tsx` (inherits SelectTrigger) |
| `CommandInput` wrapper | `command.tsx` |

### Category B — Navigation Chrome

Controls that structure page or command navigation. Visually similar to Form Fields but
semantically distinct. Not required to align with Category A controls on a shared row.

| Component | File |
|---|---|
| `TabsList` | `tabs.tsx` |
| `TabsTrigger` | `tabs.tsx` |

### Category C — Expanded Controls

Variable-height controls. Height is driven by content, not a fixed tier. They share
horizontal padding with Category A but their vertical model is independent.

| Component | File |
|---|---|
| `Textarea` | `textarea.tsx` |
| `PromptInputTextarea` | `composer/prompt-input.tsx` |
| `ComposerInput` | `composer/composer.tsx` |

### Category D — Special-Context Controls

Controls with intentionally non-standard height for accessibility, branding, or distinct
interaction contexts. Each is a named exception with a documented rationale (§6).

| Component | File | Exception rationale |
|---|---|---|
| `OtpCodeInput` | `auth/otp-code-input.tsx` | Elevated touch target for one-time code entry |
| Composer attachment chips | `composer/attached-notes-list.tsx`, `composer/composer-attachment-list.tsx` | Pending decision — see §6 |

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

## 4. Size Assignment Per Category

### 4.1 Category A — Form Field Controls → `control-md`

All Category A controls use the `control-md` size:

```tsx
<Input className={cn('control-base control-md control-invalid')} />
<SelectTrigger className={cn('control-base control-md control-invalid')} />
<Button className={cn('control-base control-md')} />
```

This gives them: 36px height, 12px horizontal padding, 16px mobile / 14px desktop text, and
shared focus/invalid styling.

**Why md is the default:** 36px is the minimum height for comfortable touch targets
(WCAG 4.5.3) and the visual weight is appropriate for primary form interactions. Larger isn't
better — it wastes space on desktop. Smaller misses accessibility requirements.

### 4.2 Category A — Compact variant → `control-sm`

When a Category A control appears in a data table, inline filter bar, or other explicitly dense
layout, use `control-sm`:

```tsx
/* In a table row or filter toolbar */
<SelectTrigger
  className={cn('control-base control-sm control-invalid')}
  size="sm"
/>
```

This gives them: 32px height, 8px horizontal padding, 12px text.

**When to use:** Only when the containing surface explicitly calls out density and no mixing
with default-size controls occurs in the same row. If unsure, use `md`.

### 4.3 Icon button geometry

Icon buttons are always square at each size:

- `control-md` → `size-9` (36×36px)
- `control-sm` → `size-8` (32×32px)

**The current bug:** `Button size="icon"` is `size-8`, which is 4px shorter than the form field
size. Icon buttons next to `Input` or `SelectTrigger` misalign. The fix: change the `icon`
variant from `size-8` to `size-9`. See §5.

### 4.4 Category B — Navigation Chrome

Navigation controls (tabs, breadcrumbs, pagination) are not form fields and do not inherit from
`control-*` sizes. They have their own namespace:

```tsx
<TabsList className="nav-md">
  <TabsTrigger className="nav-trigger-md">Tab</TabsTrigger>
</TabsList>
```

These values are intentional and correct — tabs are visually distinct affordances. No changes
required.

### 4.5 Category C — Expanded Controls

Multi-line controls (textarea, rich text inputs) use a different model: a minimum height and
content-driven growth. They inherit horizontal padding from the size system but add vertical
padding for multi-line breathing room:

```tsx
<textarea className={cn('control-base control-md', 'min-h-16 py-2')} />
```

The horizontal padding comes from `control-md`. The `min-h-16` and `py-2` are additions,
not overrides. This ensures that single-line and multi-line controls in the same form share
left/right alignment.

| Component | Size | Extra classes |
|---|---|---|
| `Textarea` | `control-md` | `min-h-16 py-2` |
| `PromptInputTextarea` | `control-md` | `min-h-11 py-3` (exception — see §6) |
| `ComposerInput` | none — container handles padding | `min-h-12 p-0` (exception — see §6) |

---

## 5. Implementation Roadmap

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

## 6. Exception Register

Every Category D control and every deviation from canonical sizes must have a row here.
An exception without a row is a bug.

| Component | Canonical size | Actual size | Rationale | Reviewer |
|---|---|---|---|---|
| `OtpCodeInput` wrapper | `control-md` (36px) | `control-lg` (44px) | One-time code entry requires a large, unambiguous touch target. The oversized height also creates visual weight that communicates the security-critical nature of the field. | — |
| `PromptInputTextarea` | standard textarea (64px min) | `min-h-11` (44px) | The composer textarea starts at a single visible row before the user types, acting more like an input than a traditional textarea. Content drives growth. `min-h-11` gives the single-row start state enough breathing room. | — |
| `ComposerInput` | `px-3` horizontal padding | `p-0` | Padding is provided by the `ComposerShell` container, not the textarea itself. This prevents double-padding. | — |
| Composer chips (pending) | `control-md` (36px) | `min-h-11` (44px) | **Decision pending.** Likely correct as an exception for floating-surface touch ergonomics. Needs explicit sign-off. | — |

---

## 7. Adding a New Control Primitive

Before writing the first line of a new interactive primitive:

1. **Assign a category** (A, B, C, or D) from §2.
2. **If Category A:** apply the canonical size class from §4.1 or §4.2. Use `.control-md` or `.control-sm` exactly. Do not invent new sizes.
3. **If Category C or D:** write your exception row in §6 first. Describe why the canonical size is wrong for this control. Get design sign-off.
4. **Use `data-slot` and `data-size`** attributes so sizing can be inspected in DevTools without reading source.
5. **Add to the "No changes required" table** in §5 once the component is audited.

---

## 8. Relationship to the Broader Design System

This document governs **control density only** — height, horizontal padding, and the focus ring
that unifies them. The following concerns are out of scope here and belong in separate documents:

- Color tokens and semantic color roles
- Surface elevation and shadow scale
- Typography scale (body-1 through body-5, heading variants)
- Spacing scale (gap, margin, layout rhythm)
- Animation and transition timing
- Icon sizing outside the context of button affordances
- Responsive breakpoints

When the broader design system documents are written, this document should be linked from them
under "Interactive Controls" and should reference the typography and color token documents for
any values it currently leaves to the shared Tailwind config.
