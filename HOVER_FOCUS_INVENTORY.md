# Combined hover and focus inventory

This document consolidates explicit hover/focus styling across:

- `apps/career`
- `packages/ui`

## Scope

Included:

- App-local source files under `apps/career/app/**/*`
- Shared UI source under `packages/ui/src/**/*`
- App-level stylesheets when they define interaction behavior

Excluded:

- Default browser styles
- Interaction behavior inherited from shared components unless the app/package overrides it locally
- Storybook-only examples unless they help illustrate the style language

## Executive summary

| Area          | Hover/focus style density | Main source of interaction styling                                     |
| ------------- | ------------------------- | ---------------------------------------------------------------------- |
| `apps/career` | High                      | App-local Tailwind utilities throughout routes/components              |
| `packages/ui` | High                      | Design-system primitives and pattern components                        |

## `apps/career` inventory

### Navigation and top-level links

`apps/career/app/components/Navigation.tsx`

- Hover text color: `hover:text-foreground`
- Hover border: `hover:border-border`
- Hover background: `hover:bg-muted/50`
- Focus-visible ring on logo links: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`

### Editable array inputs/buttons

`apps/career/app/components/EditableArrayField.tsx`

- Input focus border/ring: `focus:border-ring focus:ring-ring/50`
- Remove button hover background: `hover:bg-destructive/10`
- Add button hover background: `hover:bg-accent/10`
- Cancel button hover background: `hover:bg-muted`
- Edit button hover/focus text: `hover:text-muted-foreground focus:text-muted-foreground`

### Resume customizer / job posting textarea

`apps/career/app/components/ResumeCustomizer.tsx`

- Textarea focus ring: `focus:outline-none focus:ring-2 focus:ring-ring/50`

### Slug editor

`apps/career/app/components/SlugEditor.tsx`

- Save button hover background: `hover:bg-success/10`

### Resume upload drop zone

`apps/career/app/components/UploadResumeForm.tsx`

- Idle hover border on drop area: `hover:border-muted-foreground/30`

### Heatmap cells

`apps/career/app/components/career/ActivityHeatmapCard.tsx`

- Hover ring: `hover:ring-2 hover:ring-ring/40`
- Focus ring: `focus:outline-none focus:ring-2 focus:ring-ring/40`

### Application cards

`apps/career/app/components/career/ApplicationCards.tsx`

- Card hover lift/border: `hover:-translate-y-0.5 hover:border-accent/30`
- Title color change via parent hover: `group-hover:text-primary`

### Application detail overview

`apps/career/app/components/career/ApplicationOverviewTab.tsx`

- Website/recruiter link hover text fade: `hover:text-primary/80`

### Career history

`apps/career/app/components/career/CareerHistory.tsx`

- Desktop card hover border: `hover:border-primary/30`
- Mobile row hover background: `hover:bg-muted/40`
- Mobile row focus background: `focus:bg-muted/40`
- Mobile row focus ring: `focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-inset`

### Project editor form inputs

`apps/career/app/components/career/ProjectEditorForm.tsx`

- Shared input focus treatment:
  - `focus:border-ring`
  - `focus:outline-none`
  - `focus:ring-2 focus:ring-ring/50`

### Applications tables/lists

`apps/career/app/components/career/applications/ApplicationsDesktopTable.tsx`

- Row hover background: `hover:bg-muted/30`
- Link focus background: `focus:bg-muted/30`
- Link focus outline reset: `focus:outline-none`

`apps/career/app/components/career/applications/ApplicationsMobileList.tsx`

- Row hover background: `hover:bg-muted/30`
- Link focus background: `focus:bg-muted/30`
- Link focus outline reset: `focus:outline-none`

### Account page

`apps/career/app/routes/account.tsx`

- Back link hover text: `hover:text-foreground`
- Portfolio view links hover background: `hover:bg-muted`
- Download PDF button hover background: `hover:bg-success/10`
- Create New Portfolio button hover text/background: `hover:text-primary hover:bg-accent/10`
- Replace Portfolio button hover background: `hover:bg-warning/10`
- Delete Portfolio button hover background: `hover:bg-destructive/10`
- Form textarea focus treatment: `focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50`

### Application detail page

`apps/career/app/routes/applications.$id.tsx`

- Back link hover text: `hover:text-foreground`
- Job posting link hover underline: `hover:underline`

### New application flow

`apps/career/app/routes/applications.new.tsx`

- Inline text buttons hover text: `hover:text-foreground`
- Job description textareas focus treatment:
  - `focus:ring-2 focus:ring-ring/50`
  - `focus:border-transparent`
- Back button hover text: `hover:text-foreground`
- Final cancel button hover background: `hover:bg-muted`

### Project detail/new pages

`apps/career/app/routes/projects.$id.tsx`

- Back button hover text: `hover:text-foreground`

`apps/career/app/routes/projects.new.tsx`

- Back button hover text: `hover:text-foreground`

### Projects and work list cards

`apps/career/app/routes/projects.tsx`

- List item hover background: `hover:bg-muted/30`
- List item focus-within background: `focus-within:bg-muted/30`

`apps/career/app/routes/work.tsx`

- List item hover background: `hover:bg-muted/30`
- List item focus-within background: `focus-within:bg-muted/30`

### Work detail page

`apps/career/app/routes/work.$id.tsx`

- Back button hover text: `hover:text-foreground`
- Destructive action button hover background: `hover:bg-destructive/90`

### Skills page

`apps/career/app/routes/skills.tsx`

- Remove-skill button reveal on parent hover: `group-hover:opacity-100`

### Testimonials form

`apps/career/app/routes/testimonials.tsx`

- All text inputs and textarea use the same focus treatment:
  - `focus:border-ring`
  - `focus:outline-none`
  - `focus:ring-2 focus:ring-ring/50`

### Welcome screen

`apps/career/app/welcome/welcome.tsx`

- Resource link hover underline: `hover:underline`
- Icon stroke changes on group hover: `group-hover:stroke-current`

## `packages/ui` inventory

### Global interaction policy

`packages/ui/src/styles.css`

- `*:focus { outline: none; }`
- `*:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; border-radius: inherit; }`
- Interactive elements get transitions on background/color/border/opacity
- Reusable focus utilities:
  - `focus-ring`
  - `void-focus`

### Primitive components

#### `packages/ui/src/components/button.tsx`

- Base focus:
  - `focus-visible:border-ring`
  - `focus-visible:ring-ring/50`
  - `focus-visible:ring-[3px]`
- Variants:
  - `default`: `hover:bg-primary/90`
  - `destructive`: `hover:bg-destructive/90`
  - `outline`: `hover:bg-accent hover:text-accent-foreground`
  - `secondary`: `hover:bg-secondary/80`
  - `ghost`: `hover:bg-accent hover:text-accent-foreground`
  - `link`: `hover:text-secondary-foreground hover:underline`

#### `packages/ui/src/components/badge.tsx`

- Focus:
  - `focus-visible:border-ring`
  - `focus-visible:ring-ring/50`
  - `focus-visible:ring-[3px]`
- Link hover behavior:
  - `[a&]:hover:bg-primary/90`
  - `[a&]:hover:bg-secondary/90`
  - `[a&]:hover:bg-destructive/90`
  - `[a&]:hover:bg-accent`
  - `[a&]:hover:text-accent-foreground`
  - `[a&]:hover:underline`

#### `packages/ui/src/components/input.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

#### `packages/ui/src/components/textarea.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

#### `packages/ui/src/components/select.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

#### `packages/ui/src/components/tabs.tsx`

- `TabsTrigger`:
  - `focus-visible:outline-none`
  - `focus-visible:border-foreground`
  - `focus-visible:bg-accent/40`
  - `focus-visible:text-foreground`
- `TabsContent`:
  - `focus-visible:outline-none`
  - `focus-visible:border`
  - `focus-visible:border-border`
  - `focus-visible:bg-accent/10`

#### `packages/ui/src/components/accordion.tsx`

- `hover:bg-accent`
- `hover:text-accent-foreground`
- `focus-visible:outline-none`
- `focus-visible:ring-2`
- `focus-visible:ring-ring`

#### `packages/ui/src/components/dialog.tsx`

- `hover:opacity-100`
- `focus:ring-2`
- `focus:ring-offset-2`
- `focus:ring-ring`
- `focus:outline-hidden`

#### `packages/ui/src/components/dropdown-menu.tsx`

- `focus:bg-accent`
- `focus:text-accent-foreground`
- destructive variant focus styles:
  - `data-[variant=destructive]:focus:bg-destructive/10`
  - `data-[variant=destructive]:focus:text-destructive`

#### `packages/ui/src/components/calendar.tsx`

- Previous/next controls:
  - `hover:bg-accent`
  - `hover:text-accent-foreground`
- Day buttons:
  - `hover:bg-accent`
  - `hover:text-accent-foreground`
  - `focus-visible:ring-2`
  - `focus-visible:ring-ring/40`
- `day` wrapper: `focus-within:z-20`

#### `packages/ui/src/components/switch.tsx`

- `focus-visible:border-ring`
- `focus-visible:ring-ring/50`
- `focus-visible:ring-[3px]`

#### `packages/ui/src/components/table.tsx`

- `TableRow`: `hover:bg-muted/50`

### Pattern components

#### `packages/ui/src/components/date-picker.tsx`

- Trigger button focus override:
  - `focus:border-ring`
  - `focus:ring-2`
  - `focus:ring-ring/30`

#### `packages/ui/src/components/filters/filter-chip.tsx`

- Outer chip hover: `hover:bg-muted-foreground/10`
- Remove button hover: `hover:bg-muted-foreground/20`

#### `packages/ui/src/components/auth/otp-code-input.tsx`

- Wrapper:
  - `focus-within:border-border-focus`
  - `focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-accent)]`
  - error variant with `var(--color-destructive)`
- Input: `focus:outline-none`

#### `packages/ui/src/components/auth/passkey-management.tsx`

- Delete button hover: `hover:text-destructive`
- Disabled state: `disabled:opacity-50`

#### `packages/ui/src/components/enhance/inline-enhance-tray.tsx`

- Inactive suggestion pill hover:
  - `hover:border-border-default`
  - `hover:text-foreground`

#### `packages/ui/src/components/inbox/inbox-stream-row.tsx`

- `active:bg-elevated/40`
- `focus-visible:[outline-style:solid]`
- `focus-visible:outline-2`
- `focus-visible:outline-ring`
- `focus-visible:outline-offset-2`

#### `packages/ui/src/components/composer/attached-notes-list.tsx`

- Hover:
  - `hover:border-border-default`
  - `hover:bg-surface`
- Focus-visible:
  - `focus-visible:outline`
  - `focus-visible:outline-2`
  - `focus-visible:outline-offset-2`
  - `focus-visible:outline-ring`

#### `packages/ui/src/components/composer/composer-attachment-list.tsx`

- Hover:
  - `hover:border-border-default`
  - `hover:bg-background`
- Focus-visible:
  - `focus-visible:outline`
  - `focus-visible:outline-2`
  - `focus-visible:outline-offset-2`
  - `focus-visible:outline-ring`

#### `packages/ui/src/components/composer/composer-tools.tsx`

- Inactive attached-notes button:
  - `hover:border-border-default`
  - `hover:bg-surface`
  - `hover:text-foreground`

#### `packages/ui/src/components/composer/composer-shell.tsx`

- `focus-within:border-border-focus`

#### `packages/ui/src/components/composer/note-picker-dialog.tsx`

- Close button:
  - `hover:bg-surface`
  - `hover:text-foreground`
- Note rows:
  - `hover:bg-surface`

#### `packages/ui/src/components/composer/prompt-input.tsx`

- `focus-visible:outline-none`
- `focus-visible:ring-2`
- `focus-visible:ring-ring`
- Local focused state also adds `ring-2 ring-ring`

#### `packages/ui/src/components/composer/composer.tsx`

- `focus-visible:outline-none`

### Storybook examples with hover/focus utilities

These are illustrative, not the production contract.

- `packages/ui/src/components/composer/composer-tools.stories.tsx`
- `packages/ui/src/components/composer/note-picker-dialog.stories.tsx`
- `packages/ui/src/components/composer/composer.stories.tsx`
- `packages/ui/src/components/composer/composer-shell.stories.tsx`
- `packages/ui/src/components/composer/composer-actions-row.stories.tsx`
- `packages/ui/src/components/update-guard.stories.tsx`

## Cross-project comparison

### Most app-local interaction styling

- `apps/career`

### Most comprehensive reusable interaction system

- `packages/ui`

## Notable gaps / review points

### `apps/career`

- Many components define their own hover/focus utilities directly, which is flexible but can drift over time.
- `focus-within` is used in only a few list patterns.

### `packages/ui`

- Some clickable surfaces still rely on browser defaults instead of explicit focus styling:
  - `FilterChip` outer clickable surface
  - `InlineEnhanceTray` suggestion pills
  - `PasskeyManagement` delete button
  - `NotePickerDialog` rows
- The package generally does a good job of standardizing focus rings at the primitive level.

## Best starting points for changes

- Shared primitives: `packages/ui/src/components/button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `tabs.tsx`
- Global focus policy: `packages/ui/src/styles.css`
- Career app local overrides: `apps/career/app/components/Navigation.tsx`, `apps/career/app/components/career/*`, `apps/career/app/routes/*`
