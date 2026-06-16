# `packages/ui` hover and focus analysis

This report summarizes explicit hover/focus styling in `packages/ui/src`.

## Scope

Included:

- Production component source in `packages/ui/src/**/*`
- Global styling in `packages/ui/src/styles.css`

Excluded:

- Most Storybook-only interaction examples, except where they help illustrate the package style language
- Default browser behavior and styles coming from imported third-party primitives unless overridden locally

## High-level takeaways

`packages/ui` uses a layered interaction model:

1. A **global focus policy** in `styles.css`
2. **Primitive components** with standardized hover/focus utilities
3. **Composite pattern components** that add local interaction affordances
4. **Storybook examples** that demonstrate hover states visually

The overall system is fairly consistent and keyboard-accessible, with a few exceptions where clickable controls rely on browser defaults instead of explicit focus styling.

## Global interaction policy

### `packages/ui/src/styles.css`

Key global rules:

- `*:focus { outline: none; }`
- `*:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; border-radius: inherit; }`
- Interactive elements get transitions on:
  - `background-color`
  - `color`
  - `border-color`
  - `opacity`

Reusable focus-related tokens/utilities:

- `--color-border-focus`
- `--color-prompt-border-focus`
- `focus-ring`
- `void-focus`

## Primitive components with hover/focus styling

### `packages/ui/src/components/button.tsx`

Base focus treatment:

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

Variant hover behavior:

- `default`: `hover:bg-primary/90`
- `destructive`: `hover:bg-destructive/90`
- `outline`: `hover:bg-accent hover:text-accent-foreground`
- `secondary`: `hover:bg-secondary/80`
- `ghost`: `hover:bg-accent hover:text-accent-foreground`
- `link`: `hover:text-secondary-foreground hover:underline`

### `packages/ui/src/components/badge.tsx`

Focus behavior on interactive badges:

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

Hover behavior when rendered as a link:

- `default`: `[a&]:hover:bg-primary/90`
- `secondary`: `[a&]:hover:bg-secondary/90`
- `destructive`: `[a&]:hover:bg-destructive/90`
- `outline`: `[a&]:hover:bg-accent [a&]:hover:text-accent-foreground`
- `ghost`: `[a&]:hover:bg-accent [a&]:hover:text-accent-foreground`
- `link`: `[a&]:hover:underline`

### `packages/ui/src/components/input.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

### `packages/ui/src/components/textarea.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

### `packages/ui/src/components/select.tsx`

`SelectTrigger`:

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

### `packages/ui/src/components/tabs.tsx`

`TabsTrigger`:

- `focus-visible:outline-none`
- `focus-visible:border-foreground`
- `focus-visible:bg-accent/40`
- `focus-visible:text-foreground`

`TabsContent`:

- `focus-visible:outline-none`
- `focus-visible:border`
- `focus-visible:border-border`
- `focus-visible:bg-accent/10`

### `packages/ui/src/components/accordion.tsx`

`AccordionTrigger`:

- `hover:bg-accent`
- `hover:text-accent-foreground`
- `focus-visible:outline-none`
- `focus-visible:ring-2`
- `focus-visible:ring-ring`

### `packages/ui/src/components/dialog.tsx`

`DialogClose`:

- `hover:opacity-100`
- `focus:ring-2`
- `focus:ring-offset-2`
- `focus:ring-ring`
- `focus:outline-hidden`

### `packages/ui/src/components/dropdown-menu.tsx`

`DropdownMenuItem`:

- `focus:bg-accent`
- `focus:text-accent-foreground`
- destructive variant: `data-[variant=destructive]:focus:bg-destructive/10`
- destructive variant: `data-[variant=destructive]:focus:text-destructive`

`DropdownMenuCheckboxItem`:

- `focus:bg-accent`
- `focus:text-accent-foreground`

`DropdownMenuRadioItem`:

- `focus:bg-accent`
- `focus:text-accent-foreground`

`DropdownMenuSubTrigger`:

- `focus:bg-accent`
- `focus:text-accent-foreground`

### `packages/ui/src/components/calendar.tsx`

Previous/next controls:

- `hover:bg-accent`
- `hover:text-accent-foreground`

Day buttons:

- `hover:bg-accent`
- `hover:text-accent-foreground`
- `focus-visible:ring-2`
- `focus-visible:ring-ring/40`

Structure:

- `day`: `focus-within:z-20`

### `packages/ui/src/components/switch.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

### `packages/ui/src/components/table.tsx`

- `TableRow`: `hover:bg-muted/50`

No explicit focus styling.

## Composite components and pattern-level interactions

### `packages/ui/src/components/date-picker.tsx`

The trigger button adds its own focus styling on top of `Button`:

- `focus:border-ring`
- `focus:ring-2`
- `focus:ring-ring/30`

### `packages/ui/src/components/filters/filter-chip.tsx`

Outer chip:

- `hover:bg-muted-foreground/10`

Remove button:

- `hover:bg-muted-foreground/20`

This component is notable because the outer clickable `div` has `role="button"` and `tabIndex`, but no explicit focus styling.

### `packages/ui/src/components/auth/otp-code-input.tsx`

Wrapper:

- `focus-within:border-border-focus`
- `focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-accent)]`
- error variant: `focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-destructive)]`

Input:

- `focus:outline-none`

This is one of the strongest custom focus treatments in the package.

### `packages/ui/src/components/auth/passkey-management.tsx`

Delete button:

- `hover:text-destructive`
- `disabled:opacity-50`

No explicit keyboard focus styling.

### `packages/ui/src/components/enhance/inline-enhance-tray.tsx`

Suggestion pills:

- inactive state: `hover:border-border-default`
- inactive state: `hover:text-foreground`

No explicit focus styling.

### `packages/ui/src/components/inbox/inbox-stream-row.tsx`

Row link:

- `active:bg-elevated/40`
- `focus-visible:[outline-style:solid]`
- `focus-visible:outline-2`
- `focus-visible:outline-ring`
- `focus-visible:outline-offset-2`

This is one of the cleanest accessible row patterns in the package.

### `packages/ui/src/components/composer/attached-notes-list.tsx`

Removable note pill:

- `hover:border-border-default`
- `hover:bg-surface`
- `focus-visible:outline`
- `focus-visible:outline-2`
- `focus-visible:outline-offset-2`
- `focus-visible:outline-ring`

### `packages/ui/src/components/composer/composer-attachment-list.tsx`

Same basic interaction model as attached notes:

- `hover:border-border-default`
- `hover:bg-background`
- `focus-visible:outline`
- `focus-visible:outline-2`
- `focus-visible:outline-offset-2`
- `focus-visible:outline-ring`

### `packages/ui/src/components/composer/composer-tools.tsx`

Inactive attached-notes button:

- `hover:border-border-default`
- `hover:bg-surface`
- `hover:text-foreground`

### `packages/ui/src/components/composer/composer-shell.tsx`

Container-level focus affordance:

- `focus-within:border-border-focus`

### `packages/ui/src/components/composer/note-picker-dialog.tsx`

Close button:

- `hover:bg-surface`
- `hover:text-foreground`

Note rows:

- `hover:bg-surface`

No explicit focus styling on the row buttons.

### `packages/ui/src/components/composer/prompt-input.tsx`

Textarea:

- `focus-visible:outline-none`
- `focus-visible:ring-2`
- `focus-visible:ring-ring`

It also tracks local focus state and applies:

- `ring-2 ring-ring`

So it combines CSS-driven and state-driven focus indication.

### `packages/ui/src/components/composer/composer.tsx`

Textarea:

- `focus-visible:outline-none`

No custom ring; it relies on surrounding shell styling.

## Storybook-only hover/focus examples

These are illustrative rather than part of the core production contract.

### `packages/ui/src/components/composer/composer-tools.stories.tsx`

- `hover:bg-surface`

### `packages/ui/src/components/composer/note-picker-dialog.stories.tsx`

- `hover:bg-surface`

### `packages/ui/src/components/composer/composer.stories.tsx`

- `focus:outline-none`
- `focus:ring-2`
- `focus:ring-accent`
- `hover:bg-surface`
- `hover:opacity-90`

### `packages/ui/src/components/composer/composer-shell.stories.tsx`

- `hover:bg-accent/90`
- `hover:bg-bg-surface`

### `packages/ui/src/components/composer/composer-actions-row.stories.tsx`

- `hover:bg-surface`
- `hover:opacity-90`

### `packages/ui/src/components/update-guard.stories.tsx`

- `hover:opacity-90`

## Notable patterns

### Strong consistency

- Most primitives use the same ring color and ring width conventions.
- `focus-visible` is the dominant pattern for user-facing controls.
- Hover feedback generally uses small, token-based color shifts rather than layout changes.

### Strong accessible composites

- `inbox-stream-row.tsx`
- `otp-code-input.tsx`
- `composer-shell.tsx`
- `attached-notes-list.tsx`
- `composer-attachment-list.tsx`

These provide good visible affordances for keyboard and pointer interaction.

### Areas to review

- `FilterChip` outer clickable surface has no explicit focus style.
- `InlineEnhanceTray` suggestion pills are hover-only.
- `PasskeyManagement` delete button relies mostly on browser defaults.
- `NotePickerDialog` rows are hover-only.

## Best starting points for changes

- Global focus behavior: `packages/ui/src/styles.css`
- Core button styling: `packages/ui/src/components/button.tsx`
- Form controls: `input.tsx`, `textarea.tsx`, `select.tsx`
- Accessible row patterns: `inbox-stream-row.tsx`, `attached-notes-list.tsx`, `composer-attachment-list.tsx`
- Composite focus containers: `otp-code-input.tsx`, `composer-shell.tsx`
- Hover-heavy component patterns: `calendar.tsx`, `accordion.tsx`, `dropdown-menu.tsx`
