# Career app hover and focus inventory

Audit scope: `apps/career/app/**/*`

Notes:

- This inventory covers explicit hover/focus styling in the career app source.
- `apps/career/app/app.css` does not define any hover/focus rules.
- Shared interaction styles from `@hominem/ui` are not included unless the app overrides them locally.

## Summary

| Pattern                      | Files                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hover text color / underline | `Navigation.tsx`, `projects.$id.tsx`, `projects.new.tsx`, `work.$id.tsx`, `applications.$id.tsx`, `applications.new.tsx`, `welcome.tsx`, `account.tsx`, `EditableArrayField.tsx`, `ApplicationOverviewTab.tsx`, `SlugEditor.tsx` |
| Hover background / border    | `Navigation.tsx`, `EditableArrayField.tsx`, `UploadResumeForm.tsx`, `ApplicationCards.tsx`, `CareerHistory.tsx`, `ApplicationsDesktopTable.tsx`, `ApplicationsMobileList.tsx`, `projects.tsx`, `work.tsx`, `account.tsx`         |
| Focus ring / outline         | `Navigation.tsx`, `EditableArrayField.tsx`, `ResumeCustomizer.tsx`, `ActivityHeatmapCard.tsx`, `CareerHistory.tsx`, `ProjectEditorForm.tsx`, `testimonials.tsx`, `account.tsx`, `applications.new.tsx`                           |
| Group hover                  | `ApplicationCards.tsx`, `skills.tsx`, `welcome.tsx`                                                                                                                                                                              |
| Focus-within                 | `projects.tsx`, `work.tsx`                                                                                                                                                                                                       |

## Detailed inventory

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

## Cross-cutting notes

- Hover text color is the most common pattern.
- Hover background is used mostly for nav items, list rows, and secondary actions.
- Focus rings are concentrated on form fields and keyboard-accessible rows.
- `group-hover` is used sparingly for reveal or emphasis effects.
- `focus-within` only appears on the project and work summary lists.
