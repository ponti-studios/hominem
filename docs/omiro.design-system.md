# Omiro design system

One set of tokens, shapes and primitives for the whole app. Screens compose
these; they do not define their own colors, radii or type.

## Tokens (`apps/omiro/components/theme/tokens.ts`)

Plain data, shared by the restyle theme (`theme.ts`), native code and tests.

| Group    | Tokens                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Ground   | `background` (lavender `#F5F3FF` / near-black `#0E0C1A`), `card`, `muted`, `border`                     |
| Text     | `foreground`, `mutedForeground`                                                                          |
| Action   | `primary` (violet `#6C4DFF`) with `primaryForeground`; `destructive`                                    |
| Inverted | `ink` / `inkForeground`: the capture bar, toasts, selected day pill, "ink" buttons                       |
| Accents  | `coral` (now marker, badges, errors), `lime` / `limeForeground` (completion)                            |
| Events   | `eventViolet`, `eventCoral`, `eventSky`, `eventSun` pastel fills with `eventForeground`                 |
| Radii    | `sm 6`, `md 10`, `lg 14`, `xl 22` (cards), `2xl 28`, `pill 999` (buttons, chips, bars)                  |
| Shadows  | `float` only (capture bar, sheets, toasts). List rows and cards are flat.                                |
| Type     | Geist. Titles are 700; use `display`, `title1`, `title2`, `cardTitle`, `headline`, `label`, `chip`, `body`, `subhead`, `footnote`. |

`tests/components/theme/tokens.test.ts` enforces WCAG AA contrast for the
text/fill pairs above in both light and dark. Add a pair there when you add a
token that carries text.

## Primitives (`apps/omiro/components/ui`)

- `Button`: pill; `size` `sm | md | lg`; variants `primary`, `ink`, `secondary`,
  `destructive`, `outline`, `ghost`.
- `IconButton`: circle; `size` `sm | md | lg`; variants `bordered`, `plain`,
  `solid`, `tonal`, `ink`.
- `Chip`: pill with optional icon; tones `tonal`, `ink`, `outline`.
- `Checkbox`: chunky square, lime when done, with a UI-thread pop.
- `BottomSheet`: the modal surface (scrim, spring slide, drag to dismiss).
- `Card`: 22 px radius, no border.
- `TextField`, `ListRow`, `EmptyState`: tokenized radii.

## Rules

- Never use a hex literal or a numeric `borderRadius` for a surface; use a
  token. Tiny elements (dots, skeleton lines, 2 to 6 px bars) may use a number.
- Distinguish things by shape and fill, not hue alone (events are color blocks,
  tasks are white cards with a checkbox).
- No blur shadows on repeated rows. Animate `transform` and `opacity` only, on
  the UI thread.
