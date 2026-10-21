# Omiro design system

One set of tokens, shapes and primitives for the whole app. Screens compose
these; they do not define their own colors, radii or type.

## Tokens (`apps/omiro/components/theme/tokens.ts`)

Plain data, shared by the restyle theme (`theme.ts`), native code and tests.

| Group    | Tokens                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ground   | `background` (lavender `#F5F3FF` / near-black `#0E0C1A`), `card`, `muted`, `border`                                                                                                                                        |
| Text     | `foreground`, `mutedForeground`                                                                                                                                                                                            |
| Action   | `primary` (violet `#6C4DFF`) with `primaryForeground`; `destructive`                                                                                                                                                       |
| Inverted | `ink` / `inkForeground`: selected day pill, "ink" buttons. These flip with the color scheme.                                                                                                                               |
| Bar      | `bar` / `barForeground` / `barAccent` / `barAccentForeground`: the composer, search bar, attachment menu, toasts, and the dock's stopping and failed bars. Fixed dark (`#14121F`, white text, violet `#6C4DFF` chip) in both color schemes. |
| Scrim    | `overlayScrim` (dims what is behind a sheet or a swipe), `scrimForeground` (white text and icons on it)                                                                                                                    |
| Tiles    | `barControl` (controls on a bar surface), `neutralTile` (rejected tool-call icon tile)                                                                                                                                     |
| Accents  | `coral` (now marker, badges, errors), `lime` / `limeForeground` (completion)                                                                                                                                               |
| Events   | `eventViolet`, `eventCoral`, `eventSky`, `eventSun` pastel fills with `eventForeground`                                                                                                                                    |
| Radii    | `sm 6`, `md 10`, `lg 14`, `xl 22` (cards), `2xl 28`, `pill 999` (buttons, chips, bars)                                                                                                                                     |
| Rule     | No hex or `rgba()` literals outside `components/theme/`. Add a token instead.                                                                                                                                              |
| Shadows  | `float` (sheets) and `bar` (`float` plus a 1px white 10% ring, for the fixed dark bars). List rows and cards are flat.                                                                                                     |
| Type     | Geist. Titles are 700; use `display`, `title1`, `title2`, `cardTitle`, `headline`, `label`, `chip`, `body`, `subhead`, `footnote`.                                                                                         |

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

## Auth and launch surfaces

Launch and sign-in are one continuous moment built around the mascot. They use
the same visual language as the inbox: lavender ground, the capture bar's ink
pill, violet action, lime for success.

**Launch.** The native splash (`expo-splash-screen`) is the mascot on its own,
centred, at `LAUNCH_MASCOT_WIDTH` (`components/auth/brand-layout.ts`, mirrored
by `imageWidth` in `app.config.js`; a test keeps the two equal). The in-app
`LaunchOverlay` (`components/launch/LaunchOverlay.tsx`) draws the identical
frame, so the native splash can be hidden the moment the mascot is on screen
without a visible swap. It then says hello (the wordmark types in), waits for
sign-in state and the query cache to settle, and hands off:

- Signed out: the mascot and wordmark travel to where the login screen lays
  them out (one transform, 900ms) while the login form rises in. The login
  screen's own brand takes over when the overlay lands.
- Signed in: the overlay lifts away over the inbox (450ms).

Both layouts come from `brand-layout.ts`; change the numbers there, not in one
place only. E2E runs (`APP_ENV=e2e`) have no overlay.

**Login.** One screen, `app/(auth)/index.tsx`, with two steps that share a fixed
slot so the screen never moves between them:

- Email: the capture bar's ink pill with a violet send circle
  (`EmailComposer`). The circle pulses when the address looks valid.
- Code: six ink "pebbles" over a real, transparent text input
  (`CodePebbles`), so iOS can still autofill the code and the keyboard behaves
  normally. They are dealt out from the send circle's position. The sixth digit
  submits; there is no verify button. Pebbles wave while checking, turn lime on
  success, and shake with a destructive ring on a wrong code.
- Resend is disabled for `RESEND_COOLDOWN_SECONDS` (30) after a send.
- A successful sign-in holds the route guards for `SUCCESS_HOLD_MS` so the
  success moment (lime pebbles, the mascot's hop) can finish before the inbox.
- An emailed link `verify?email=...&token=...` rewrites to this screen and
  opens on the code step with the code submitted (`+native-intent.ts`).

**Mascot.** It floats, leans toward the form on the code step, nods on each
keystroke, and hops on success. It talks through a speech bubble under the
wordmark (`SpeechBubble`); the lines live in `translations` under
`auth.mascot`. The bubble is as wide as its text and wraps inside a reserved
slot (`BUBBLE_SLOT_HEIGHT`), so keep each line to about three lines of text
when translating.

Motion follows the rules above (transform and opacity only, on the UI thread).
Reduced motion drops the travel, the float, the lean, the pebble deal and the
rise, and keeps short fades.

Not handled: right-to-left layout. The app does not support RTL yet; the
pebble row is pinned left-to-right so a code reads in order either way.
