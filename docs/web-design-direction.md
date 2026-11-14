---
title: Web design direction
summary: Mandatory monochrome design contract for the Hominem web app.
type: guide
status: active
owner: charlesponti
tags: [design, web, interface]
related: [authentication.md, billing.md]
updated: 2026-11-14
---

# Web design direction

The Hominem billing page and account shell define the visual language for
`apps/web`. This contract is mandatory for every route, feature, shared
component, and Storybook example. The design system has one monochrome theme;
product areas do not get their own palettes or visual identities.

This contract governs presentation only. Preserve each page's routes,
navigation, content, permissions, and behavior unless the product owner
explicitly changes them. Match the visual language, not the billing page's
information architecture.

Navigation uses one shared hierarchy: root domains in the desktop sidebar,
with the active domain's destinations nested directly below it. On narrow
screens, the same hierarchy opens from the app header in a navigation drawer.
On desktop, the sidebar also holds the Hominem link, Jump to control, and
account menu; do not render a full-width app header. On narrow screens, retain
only the menu trigger and current page label above the content. Sub-app layouts
must not add a second primary or section navigation strip.

Selected navigation links use the primary ink surface with inverse text.

## Non-negotiable visual rules

- Use a white or near-white page ground, near-black ink, and neutral gray
  supporting colors. Use the semantic tokens in `apps/web/app/app.css`; do not
  put color literals in route or component markup.
- Use Hanken Grotesk for readable content and JetBrains Mono only for compact
  metadata, short section labels, and action labels. Do not add display,
  pixel, terminal, or decorative typefaces.
- Create hierarchy with type size, weight, spacing, alignment, and thin neutral
  rules. Keep content on a shared readable column and leave room between
  sections.
- Prefer plain sections and rows. Use a pale neutral rectangular surface only
  when it groups related data or a cohesive read-only summary. Do not wrap
  every section or row in a card.
- Controls are direct and rectangular or nearly square. The primary action is
  near-black with white text; secondary actions use a white fill and dark
  outline. Keep boundaries, keyboard focus, disabled states, and 44 px minimum
  touch targets clear.
- Use sentence case for titles and body text. Uppercase is limited to brief
  mono labels and action text. Use tabular numerals for money, counts, dates,
  and limits.
- Keep layouts responsive by reducing outer padding and stacking content in
  reading order. Never introduce horizontal page scrolling or shrink body text
  to force a fit.

## Prohibited visual treatments

Do not use color as decoration. The only color exceptions are semantic status
colors for success, warning, destructive, or other established meaning, and
data visualization where distinct series are necessary to read the data.
These exceptions must use existing semantic tokens and never become a page or
feature palette.

The following are prohibited throughout `apps/web`, including Storybook:

- Neon accents, multi-color accents, gradients, aurora, glow, bloom, or
  luminous text and borders.
- Cyberpunk, Matrix, terminal, arcade, glitch, scanline, pixel-grid, or
  sci-fi visual motifs.
- Glass, translucent chrome, backdrop blur, decorative texture, ambient
  backgrounds, or animated decoration.
- Decorative shadows, floating-card effects, pill-shaped page navigation, or
  excessive rounded panels.
- Feature-specific themes, per-domain colors, hard-coded color values, or
  local replacements for shared components and tokens.

Motion is limited to feedback that explains an interaction or state change.
Keep it brief, preserve reduced-motion behavior, and do not animate ambient
decoration.

The Transactions ledger uses a more expressive, layered motion sequence:
the page settles in over 240 ms, its controls follow 60 ms later, and only the
first five rows stagger in at 24 ms intervals. Selection feedback and the
details drawer animate their state changes. Keep transaction values still
after entry, and reduce motion to a short opacity fade without positional
movement.

## Theme tokens

Use these semantic roles through the existing web theme variables. If the
shared system is missing a needed role, add it in the token source and show it
in Storybook before using it. Do not create aliases or one-off values in a
feature.

| Role | Value | Use |
| --- | --- | --- |
| Page background | `#ffffff` | Main page ground |
| Primary ink | `#0a0a0a` | Main text and primary action |
| Supporting ink | `#5c5c5c` | Secondary text |
| Quiet ink | `#737373` | Metadata and tertiary text |
| Rule | `#e0e0e0` | Dividers and control boundaries |
| Quiet surface | `#f5f5f5` | Grouped data and read-only summaries |
| Inverse text | `#ffffff` | Text on primary ink |

The source implementation is the current billing page at
`services/api/src/routes/billing/index.tsx` and the account shell at
`services/api/src/routes/login/app/account-shell.module.css`. The web app maps
these roles to its semantic theme tokens in `apps/web/app/app.css`.

## Composition and content

1. Start with a short, direct page title. Add one supporting sentence only
   when it explains a choice or consequence.
2. Put the main task or information directly after the heading.
3. Separate related sections with spacing and a fine rule. Use a quiet surface
   only for cohesive read-only data.
4. Use one primary action per decision point. Apply destructive styling only
   to destructive actions.
5. Present usage before commentary. Pair meters with accessible labels and
   numeric values; omit meters for concepts with no finite limit.

Do not add generic introductions, decorative badges, redundant labels, or
dashboard widgets. Keep necessary information and controls intact.

### Route headers

- Keep every route header on the same structure: a compact mono section label
  and its actions share the first row; the page title and any useful supporting
  sentence follow beneath. Detail routes use the same first row and add their
  back control before the section label.
- Use the shared `PageHeader` or `DetailHero` component. Do not hand-roll a
  route-specific header. A visually omitted title must remain as an accessible
  heading.
- Use the shared `AddButton` for compact add actions. It displays the plus icon
  and exposes the action name as its accessible label and tooltip.
- Explain the purpose of a status or invitation panel in its heading and empty
  state. Remove the panel only when its underlying workflow is removed.

## Shared components and Storybook

- Compose page UI from the existing exports in
  `apps/web/app/components/design/index.ts` and shared controls. Extend the
  shared component or token when a real need is missing; do not invent a
  route-local version.
- Storybook is the visual contract for the shared design system. Every shared
  component and state must use the same semantic tokens as the app. Stories
  must demonstrate neutral, success, warning, destructive, focus, disabled,
  loading, and empty states where relevant.
- Do not use Storybook to legitimize a visual exception. Remove obsolete
  themes, palettes, and stories when the system changes.
- The design boundary test in `apps/web/app/lib/design-boundary.test.ts` is a
  ratchet: new route UI must use shared components and semantic tokens. If an
  exception is needed, get product-owner approval and document the scoped
  exception here before implementing it.

## Restyle workflow

1. Read this contract and inspect the target page's current route, states,
   interactions, navigation, and responsive behavior.
2. Inspect the shared design exports, tokens, and Storybook before changing
   presentation.
3. Preserve the existing route, content meaning, permissions, and behavior.
4. Use the monochrome hierarchy above and the fewest shared components needed.
5. Review loading, empty, error, success, disabled, destructive, focus,
   keyboard, and narrow-screen states that apply to the page.
6. Update or add Storybook coverage for a changed shared component. Format the
   changed files and run the web package checks.

## Reference implementation

- Billing page: `services/api/src/routes/billing/index.tsx`.
- Account shell and shared monochrome account styles:
  `services/api/src/routes/login/app/account-shell.tsx` and
  `services/api/src/routes/login/app/account-shell.module.css`.
- Web theme tokens: `apps/web/app/app.css`.
- Shared component exports: `apps/web/app/components/design/index.ts`.
- Storybook examples: `apps/web/app/components/design/*.stories.tsx`.
