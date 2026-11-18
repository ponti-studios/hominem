# Omiro design system

One set of tokens, shapes and primitives for the whole app. Screens compose
these; they do not define their own colors, radii or type.

The look is Apple's Liquid Glass: content sits on a calm ground, and the
controls float above it on real system glass. Three layers, always in this
order:

1. **Ground.** `background`, with a soft aurora wash (`AuroraBackground`) at
   the top of root screens so the glass above has something to bend.
2. **Content.** Opaque cards and rows (`card`). Flat: no border, no shadow.
3. **Glass.** Chrome only: the tab bar, navigation bar buttons, the composer,
   floating header buttons, toasts, popups and the sheet. Never content rows,
   and never glass stacked on glass.

## Tokens (`apps/omiro/components/theme/tokens.ts`)

Plain data, shared by the restyle theme (`theme.ts`), native code and tests.

| Group    | Tokens                                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ground   | `background` (lavender `#F4F2FB` / near-black `#0B0A14`), `card`, `muted`, `border`                                                                                                                         |
| Aurora   | `aurora1`, `aurora2`, `aurora3`: the three soft colour pools behind root screens                                                                                                                            |
| Text     | `foreground`, `mutedForeground`                                                                                                                                                                             |
| Action   | `primary` (violet `#6C4DFF`) with `primaryForeground`; `destructive`                                                                                                                                        |
| Inverted | `ink` / `inkForeground`: selected day pill, "ink" buttons. These flip with the color scheme.                                                                                                                |
| Glass    | `glassTint` (the tint handed to system glass), `glassFallback` (the solid fill used when glass is off), `glassStroke` (the fallback's hairline edge)                                                         |
| Bar      | `bar` / `barForeground` / `barAccent` / `barAccentForeground`: what is drawn on a glass bar (composer, search bar, attachment menu, toasts, the dock's stopping and failed bars). They follow the color scheme. |
| Scrim    | `overlayScrim` (dims what is behind a sheet or a swipe), `scrimForeground` (white text and icons on it)                                                                                                     |
| Tiles    | `barControl` (controls on a bar surface), `neutralTile` (rejected tool-call icon tile)                                                                                                                      |
| Accents  | `coral` (now marker, badges, errors), `lime` / `limeForeground` (completion)                                                                                                                                |
| Events   | `eventViolet`, `eventCoral`, `eventSky`, `eventSun` pastel fills with `eventForeground`                                                                                                                     |
| Radii    | `sm 8`, `md 12`, `lg 16`, `xl 26` (cards), `2xl 34` (sheets), `pill 999` (buttons, chips, bars). Nested corners are concentric: inner radius = outer radius minus the padding between them.                  |
| Rule     | No hex or `rgba()` literals outside `components/theme/`. Add a token instead.                                                                                                                               |
| Shadows  | `float` only, and only under the glass fallback. Real glass carries its own depth; list rows and cards are flat.                                                                                            |
| Type     | Geist. Titles are 700; use `display`, `largeTitle`, `title1`, `title2`, `cardTitle`, `headline`, `label`, `chip`, `body`, `subhead`, `footnote`.                                                            |

`tests/components/theme/tokens.test.ts` enforces WCAG AA contrast for the
text/fill pairs above in both light and dark, including bar text on the glass
fallback. Add a pair there when you add a token that carries text.

## Glass (`apps/omiro/components/ui/glass.tsx`)

`Glass` is the only way to draw a glass surface. It renders system Liquid Glass
(`expo-glass-effect`) and swaps to the opaque `glassFallback` fill with a
`glassStroke` edge when the person has Reduce Transparency on.

- `interactive` makes the glass react to touch (buttons, the composer). Leave
  it off for passive surfaces (toasts).
- `GlassGroup` wraps neighbouring glass shapes so they blend and morph into
  each other instead of overlapping.
- Do not animate the opacity of a glass surface or any of its parents: system
  glass stops rendering below full opacity. Move or scale it instead.
- Navigation bars, bar buttons, the tab bar and form sheets get their glass
  from the system. Do not paint a background behind them.

## Motion (`apps/omiro/services/motion/native-motion.ts`)

Motion is spring-first, named after the SwiftUI presets it matches:

| Preset   | Use                                                        |
| -------- | ---------------------------------------------------------- |
| `snappy` | Presses, toggles, chips, anything that answers a touch     |
| `smooth` | Sheets, docks and bars changing size or place              |
| `bouncy` | Arrivals worth noticing: a new row, a toast, a completion  |

- Everything pressable scales down on touch (`PressableScale`, 0.96) and
  springs back; it does not just dim.
- Lists open their detail screen with the system zoom transition from the row.
- Symbols animate with SF Symbol effects (bounce, replace), not custom drawing.
- Haptics mark a commit (send, complete, delete), not a touch.
- Reduce Motion replaces every transform with a short fade.

## Primitives (`apps/omiro/components/ui`)

- `Glass`, `GlassGroup`: see above.
- `PressableScale`: the press feedback every control is built on.
- `Button`: pill; `size` `sm | md | lg`; variants `primary`, `ink`, `secondary`,
  `destructive`, `outline`, `ghost`, `glass`.
- `IconButton`: circle; `size` `sm | md | lg`; variants `bordered`, `plain`,
  `solid`, `tonal`, `ink`, `glass`.
- `Chip`: pill with optional icon; tones `tonal`, `ink`, `outline`, `card`,
  `glass`.
- `Checkbox`: chunky square, lime when done, with a UI-thread pop.
- `BottomSheet`: the modal surface (scrim, spring slide, drag to dismiss).
- `Card`: 26 px radius, no border.
- `AuroraBackground`: the ground wash for root screens.
- `TextField`, `ListRow`, `EmptyState`: tokenized radii.

## Rules

- Never use a hex literal or a numeric `borderRadius` for a surface; use a
  token. Tiny elements (dots, skeleton lines, 2 to 6 px bars) may use a number.
- Distinguish things by shape and fill, not hue alone (events are color blocks,
  tasks are white cards with a checkbox).
- Glass is for chrome. A screen has at most one glass layer above its content.
- No blur shadows on repeated rows. Animate `transform` and `opacity` only, on
  the UI thread (and never the opacity of glass).

## Auth and launch surfaces

Launch and sign-in are one continuous moment built around the mascot. They use
the same visual language as the inbox: lavender ground with the aurora wash,
the capture bar's glass pill, violet action, lime for success.

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

- Email: the capture bar's glass pill with a violet send circle
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
