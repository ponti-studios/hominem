# III. Experience

The Omiro interface is a closed system, not a style guide. Every token,
component, and screen rule below is exhaustive: if a value, variant, or pattern
is not listed, it does not exist in this product. "It feels better" is not a
valid exception, and neither is "just this once."

## Ceremony budget

Hierarchy comes from **typography and whitespace first**. Color, borders,
radius, and containers are not alternate ways to achieve the same hierarchy
— they are exceptions that require the first two tools to have already
failed. Before adding a background, a border, or a card, the question is
always: *can a bigger gap or a heavier type token say this instead?* If
yes, that's the answer.

This means:

- No decorative containers. A "card" exists only where §2 explicitly
  grants one (Modal/Sheet). Everywhere else, a section is text and space,
  not a box.
- No default borders — with one standing exception: Input (Primitives §2)
  is always a bordered box, because a text field has to read as a text
  field. Outside of Input, whitespace separates content; a divider line
  (List row) and the Button `outline` variant (Primitives §2) are the
  two further named, rare exceptions — not a habit.
- One radius, applied uniformly, plus the one that's a geometric necessity
  (a circle can't be "less round"). Not a scale to choose from.
- A palette of two colors plus two state colors. Hierarchy within text is
  opacity, not a new named color.

The document has four layers. Each layer only uses primitives defined in the
layer above it:

1. **Foundations** — the closed set of tokens (color, spacing, radius, type,
   elevation, iconography, motion).
2. **Primitives** — the closed set of components, each with a fixed contract
   (variants, sizes, states).
3. **Patterns** — how primitives compose into screens.
4. **Review gates** — the pass/fail check applied before anything ships.

---

## 1. Foundations

Tokens are the only legal source of a color, dimension, or duration in
screen code. Rule 72 makes this load-bearing: hardcoding any value below in
route/screen code is a review failure, not a style nitpick.

### 1.1 Color

Two colors, plus two state colors. That's the whole palette. Screen code
references `foreground`, never a hex value or a raw palette step.

| Token              | Purpose                                       |
| ------------------ | ---------------------------------------------- |
| `background`       | The only background. Every screen, row, and input sits directly on it. |
| `foreground`       | The only text/icon color. Hierarchy within text comes from the opacity steps below, not a second color. |
| `accent`           | The single interactive/brand color. Selection, primary actions, links. |
| `text-on-accent`   | Text/icon color on top of `accent` or `destructive` fills. |
| `destructive`      | Destructive actions and error state only.        |
| `divider`          | The *only* border/line token in the system. Reserved for the rare, documented exception in Rule 10a — never a default. |
| `overlay-scrim`    | Modal/sheet backdrop only.                       |

Opacity steps (applied to `foreground`, not separate colors):

| Token                | Opacity | Use                                       |
| -------------------- | ------- | -------------------------------------------|
| `foreground/100`     | 100%    | Primary reading text, active icons.        |
| `foreground/64`      | 64%     | Supporting text, secondary labels.         |
| `foreground/38`      | 38%     | Placeholder, disabled, metadata, timestamps. |

Rules:

- There is exactly one `accent` and no second interactive color, ever.
- `success` / `warning` do not exist as standing tokens. If one screen
  truly needs a third state color, it's a documented, one-off addition
  to that screen — not a palette entry available everywhere.
- Text hierarchy is `foreground` at a different opacity step, never a
  different hue. If a designer reaches for gray-on-gray, the answer is
  `foreground/64`, not a new token.
- `divider` exists to be almost never used (see Rule 10a). Its existence
  is not permission to add a border by default.

### 1.2 Spacing

8pt grid. 4pt exists only for internal alignment inside a control (icon-to-label gaps, text baseline nudges) — it never sets margin or padding between two semantic groups.

| Token        | Value | Legal use                                    |
| ------------ | ----- | --------------------------------------------- |
| `space-025`  | 4pt   | Internal alignment only. Never a group gap.   |
| `space-050`  | 8pt   | Tightest legal gap between related elements.  |
| `space-100`  | 16pt  | Screen horizontal gutter. Default group gap.  |
| `space-150`  | 24pt  | Gap between sections.                          |
| `space-200`  | 32pt  | Gap between major screen regions.              |
| `space-300`  | 48pt  | Rare: full-screen empty/error state padding.  |
| `space-400`  | 64pt  | Reserved. Do not use without a documented exception below. |

- Mobile content uses `space-100` (16pt) as the horizontal gutter. Content
  never touches the screen edge.
- Any spacing value not on this table is a bug, not a design decision.

### 1.3 Radius

One radius, applied everywhere a radius is legal, plus the one exception
that is a geometric necessity rather than a style choice.

| Token         | Value  | Legal use                                        |
| ------------- | ------ | --------------------------------------------------|
| `radius`      | 8pt    | The only radius. Buttons, inputs, Modal/Sheet, any control that needs one. |
| `radius-full` | 9999pt | Circles and capsules only: avatars, icon buttons, pills. Not a style choice — a capsule mathematically can't use `radius`. |

There is no scale to choose from. A control either uses `radius`, uses
`radius-full` because it's circular, or is square. Nothing is ever "a
little more rounded" than something else on the same screen.

### 1.4 Typography

One type scale. No screen defines its own font size.

| Token       | Size / Line height | Weight    | Use                                  |
| ----------- | ------------------- | --------- | -------------------------------------- |
| `title-lg`  | 28 / 34             | Bold      | Rare: a screen's single hero title, if any. |
| `title`     | 22 / 28             | Semibold  | Screen title.                          |
| `headline`  | 17 / 22             | Semibold  | Section header, row title.             |
| `body`      | 17 / 22             | Regular   | Default reading text, button labels.   |
| `subhead`   | 15 / 20             | Regular   | Secondary row text, form labels.       |
| `caption`   | 13 / 18             | Regular   | Metadata, timestamps, helper text.     |
| `footnote`  | 11 / 13             | Regular   | Legal text, rare fine print.           |

All-caps rendering (`text-transform: uppercase`) is not a legal style on
any token. Sentence case is enforced at the copy layer (Pattern rules,
§3.4), not by casing text visually.

### 1.5 Elevation

Almost everything is `elevation-0`. There is exactly one thing that is
ever allowed to sit above it.

| Token           | Surface token | Shadow                          | Use                                    |
| --------------- | -------------- | -------------------------------- | ----------------------------------------|
| `elevation-0`   | `background`  | None.                             | Every screen, row, input, list — everything except Modal/Sheet. |
| `elevation-1`   | `background`  | One functional shadow or scrim.  | Modal/Sheet only. It needs to read as "above" the screen; nothing else does. |

There is no `elevation-2`. Cards, rows, and sections do not get their own
background tint or shadow to separate from the screen — that's what
`space-150`/`space-200` are for (§1.2). If a component seems to need a
third elevation step, it's composed wrong: flatten it (Rule 10, 10a).

### 1.6 Iconography

- **Source:** SF Symbols by default, via `tintColor`. State (selected,
  unselected, disabled, pressed) is expressed by recoloring the same glyph,
  never by swapping to a different asset per state.
- **Custom icon sets** (a bitmap replacing an SF Symbol because no symbol
  fits) are legal only as a solid alpha mask — one flat shape, no internal
  color or shading, on a transparent background — supplied at `@1x/@2x/@3x`.
  This lets `tintColor` recolor it exactly like an SF Symbol, so it carries
  selected/unselected state the same way every other icon in the system
  does. A full-color or multi-tone bitmap icon is not a legal shortcut
  around the token system, no matter how small the use case.

### 1.7 Motion

| Token             | Duration | Easing                          | Use                                  |
| ----------------- | -------- | -------------------------------- | --------------------------------------|
| `duration-instant`| 100ms    | `ease-out`                       | Press/tap feedback.                   |
| `duration-fast`   | 150ms    | `ease-out`                       | Toggles, small state changes.         |
| `duration-base`   | 200ms    | `cubic-bezier(0.2, 0, 0, 1)`     | Sheet/modal entrance, screen transitions. |
| `duration-slow`   | 300ms    | `cubic-bezier(0.2, 0, 0, 1)`     | Full-screen transitions only.         |

Every token above must resolve to `duration-instant` (or off) when the
system reduced-motion setting is on. There is no token for entertainment
animation because none is a legal use of motion (Rule 66).

---

## 2. Primitives

The closed component set. Each entry is a full contract: the variants,
sizes, and states listed are the only ones that exist. A new prop value
that isn't on this list is a new component, not a variant, and needs a
documented behavioral need (Rule 70) before it's added anywhere.

### Button

shadcn's variant taxonomy, translated to this system's tokens.

- **Variants:**
  - `primary` — filled with `accent`, `text-on-accent` label. One per screen.
  - `secondary` — filled with a muted/subtle fill (`muted` token), `foreground` label. A real action, one step down from `primary`.
  - `destructive` — filled with `destructive`, `text-on-accent` label.
  - `outline` — transparent, one `divider`-colored border, `foreground` label. The single documented exception to "no default border" (§1.1): reserved for an action that needs to read as clearly tappable without the visual weight of a fill — e.g. a row's secondary action next to a chevron-based row.
  - `ghost` — transparent, no border, `foreground` label. Lowest emphasis; used inline, never for an action a user must locate quickly.
- **Sizes:** `default` (44pt height, `space-100` horizontal padding), `compact` (36pt, dense list rows only — never a primary action).
- **Shape:** `radius` on every variant, including `outline`.
- **States:** default, pressed, disabled, loading. Loading preserves the button's committed width/height (Rule 38) and disables re-submission (Rule 39, 50).
- **Label:** verb, two words or fewer (Rule 29).
- Picking a variant is a hierarchy decision, not a taste one: `primary` for the one thing the screen wants done, `secondary`/`outline` for a real but lesser action, `ghost` only when the action's location is already obvious from context (e.g. a Cancel next to the input it cancels).

### Input

- **Sizes:** `default` only, 44pt minimum height (multiline inputs grow from that floor).
- **Boundary:** a full bordered box — `radius`, `border-default`, transparent/`background` fill. This is the one component in the system with a border by default (Ceremony budget): a bottom hairline alone doesn't read as "type here," so Input doesn't get the whitespace-only treatment the rest of §3 does.
- **States:** default, focused, error, disabled. Focused swaps the border to `accent`; error swaps it to `destructive`. Nothing else about the shape changes — no background shift, no size change.
- **Contract:** placeholder describes expected input (Rule 31); error state shows an inline message, not just a color change (Rule 77).

### Section (replaces "card")

- There is no card component. A "Section" is a `headline` label plus
  `space-150` of surrounding space — `background`, no border, no radius,
  no elevation.
- **Contract:** one semantic group per Section (Rule 11). A Section never
  wraps another Section in a visible container (Rule 10).

### List row

- Sits directly on `background`. Rows in the same list are separated by
  whitespace; a `divider` line between rows is the one standing exception
  to "whitespace only" (Rule 10a) — used only when adjacent rows would
  otherwise be genuinely ambiguous (e.g. a dense settings list with
  same-height rows and no leading icon).
- **Modes:** `navigational` (chevron, whole row tappable, no inline controls) or `actionable` (inline control, row itself not tappable). Never both (Rule 48, 49).

### Modal / Sheet

- **Elevation:** `elevation-1` — the only component allowed above `elevation-0` (§1.5).
- **Shape:** `radius`, applied to the top corners only for a sheet, all corners for a centered modal.
- **Contract:** confirmation content only; substantial content gets a screen instead (Rule 53, 54). Never nests another modal or sheet (Rule 10).

### Segmented toggle

- **Uses:** a small set of mutually exclusive views of the same content
  (e.g. Chats/Notes/Tasks) — not a substitute for a screen's worth of tabs.
- **Shape:** a `radius-full` track filled with `muted`; the selected
  segment is a `radius-full` chip filled with `accent`. Unselected segments
  are transparent.
- **Label variants:** either a `text-on-accent`/`text-secondary` text
  label per segment, or an icon per segment (Foundations §1.6) tinted
  `text-on-accent`/`text-secondary` the same way — never both in the same
  toggle. Icon-only segments require an `accessibilityLabel` per segment
  (Rule 55).
- **Size:** every segment is a minimum 44×44pt tap target (Rule 20, 74),
  even when the visual glyph or label is smaller — the track and its
  internal padding expand to guarantee this, they never shrink to fit a
  cramped header. A track sized to match a neighboring icon button's
  *visual* size without also matching its *tap* size (icon buttons get
  this for free via `hitSlop`) is a contract violation, not a style
  choice — this happened once already and produced a real sub-44pt
  control.
- **Contract:** built from our own tokens — never the platform's native
  segmented control. The OS's default glass/translucent material doesn't
  carry any of our tokens (color, radius, motion) and renders
  inconsistently against a custom background; a real screen hit this
  exact problem (`app/(protected)/index.tsx`'s Chats/Notes toggle).

### Pill / Badge

- **Uses:** compact status, filter, tag — nothing else (Rule 15).
- **Shape:** `radius-full`, the one legal use of that token outside avatars/icon buttons.
- **Size:** one size. No small/large variants.

### Spinner

- **Contract:** accessible label required (e.g. `Saving`, `Loading calendar results`) (Rule 40). Used for action loading, never content loading (Rule 41).

### Skeleton

- **Contract:** mirrors the dimensions of the content it precedes. Used for content loading, never action loading (Rule 41).

Route files compose these primitives. They do not invent new visual
patterns, new elevation levels, or new color/spacing values inline
(Rule 71, 72).

---

## 3. Patterns

Pass/fail rules for how primitives assemble into a screen.

### Screen structure

1. Every screen has one identifiable purpose.
2. Every screen has one primary action, expressed as one `primary` button.
3. The primary action is visible in the initial viewport, unscrolled.
4. Every screen has one title, using the `title` type token. The title
   names the user task, never the implementation (e.g. `Calendar`, not
   `Sync engine`).
5. A screen has at most three hierarchy levels: title, section, content.
6. Decorative hero sections, slogans, and filler content are prohibited.
7. A screen must remain understandable with all icons removed.
8. A new layout pattern is not introduced when an existing pattern
   (Pattern §3) already fits.

### Surfaces and containment

9. A Section (Primitives §2) is typography and space, not a box. It
   exists to group related content, never to "indicate state" through a
   background or border — state is shown by the control itself (Rule 44).
10. Modal and Sheet are the only components allowed a visible container
    (background separation, radius, elevation). Nothing nests inside
    itself: no sheet inside a sheet, no modal inside a modal.
10a. Whitespace is the default separator between every other pair of
    elements on a screen. A `divider` line, a tinted row background, or a
    Button's `outline` border are named exceptions (List row and Button,
    Primitives §2) and need a reason — "it looked bare" is not one.
11. One semantic group gets exactly one Section — never a Section inside
    a Section.
12. A screen uses `elevation-0` everywhere except a Modal/Sheet, which
    uses `elevation-1` (§1.5). There is no in-between.
13. If two rows on one screen ever do carry a container (the List row
    divider exception), they share the same treatment — never a mix of
    bordered and unbordered rows on one list.
14. Gradients, decorative shadows, and decorative borders are prohibited
    outright. The only legal shadow in the entire system is Modal/Sheet's
    `elevation-1` separation (§1.5).
15. Pills are restricted to compact status, filters, and tags (Primitives
    §2, Pill/Badge) — they are not a substitute for a button or a card.
16. A full-width card is never used for a single row; use a List row
    (Primitives §2) instead. Cards, in fact, are never used at all —
    see Rule 9.
17. `radius` is the only radius on any rectangular control; `radius-full`
    is legal only where the shape is a circle or capsule (§1.3). Nothing
    is ever "a bit more rounded" for taste.

### Spacing and sizing

18. Mobile content uses `space-100` (16pt) as the horizontal gutter.
19. All spacing uses a `space-*` token (§1.2). `space-025` is reserved for
    internal alignment, never a group gap.
20. Touch targets are at least 44×44pt.
21. Text inputs and primary buttons use the `default` size contract
    (44pt) from Primitives §2.
22. Content never touches the screen edge.
23. Spacing, oversized type tokens, or oversized surfaces are not used to
    create drama — pick the token the content's actual hierarchy calls for.

### Typography and copy

24. Use sentence case everywhere copy appears.
25. All-caps UI copy, slogans, and feature taglines are prohibited (§1.4).
26. Metaphors for ordinary features are prohibited.
27. Do not use "lens," "hub," "workspace," "journey," "magic," or
    "intelligence" unless the word names a concrete user concept the
    feature actually implements.
28. Titles describe the task: `Calendar`, `Archived chats`, `Account`.
29. Button labels use a verb and are two words or fewer whenever possible.
30. Labels describe the resulting action, not the component (`Delete
    chat`, not `Delete button`).
31. Placeholder text describes the expected input, not a hint of tone.
32. A title is never repeated in a subtitle beneath it.
33. An action is not explained when its label already makes it obvious.
34. Error copy states the problem and the recovery action in one sentence.
35. Empty states state what is absent and what to do next.

### Loading and async interaction

36. Loading states use a Spinner or Skeleton (Primitives §2), never words.
37. `Loading…`, `Saving…`, `Asking…`, or equivalent loading copy is
    prohibited on-screen; that meaning lives in the Spinner's accessible
    label instead.
38. A control preserves its committed dimensions while loading.
39. Duplicate interaction is disabled while an action is loading.
40. Every Spinner has an accessible label (Primitives §2).
41. Skeletons are used for content loading; Spinners are used for action
    loading. Not interchangeable.
42. Every async action defines success, empty, error, and retry states.

### State and interaction

43. Every feature defines initial, loading, success, empty, error,
    permission-denied, unavailable, and offline states before it ships.
44. Visible controls always represent the current state — no stale
    control left over from a previous state.
45. Setup controls (auth, permissions, configuration) do not appear on
    the task surface; they live in their own flow.
46. Debug controls do not appear in production UI.
47. A manual status check is not shown when status can load
    automatically.
48. A List row (Primitives §2) is either `navigational` or `actionable`,
    never ambiguously both.
49. If a row has an inline action, the row itself is not tappable
    (Primitives §2).
50. Every async action prevents duplicate submission.
51. Destructive actions require explicit confirmation via Modal
    (Primitives §2).
52. Navigation is always reversible with the platform back gesture.
53. A Modal is used for confirmation only, never for content that
    deserves its own screen.
54. A screen is used for substantial content, never for a single
    confirmation.
55. Icon-only actions require an accessible label.

### Data and trust

56. Personal data sources are named precisely (e.g. "your iOS Calendar,"
    not "your data").
57. Privacy copy describes actual behavior, not a generic assurance.

   Good: `Calendar data is processed on this device.`
   Bad: `Your data is always safe.`

58. Source metadata is shown only when it helps a user verify a result.
59. Raw implementation details are not shown by default.
60. Personal data is not persisted solely to reproduce UI.
61. The app never implies it can do something the underlying integration
    cannot do.
62. Uncertainty in an answer is expressed in the copy, not hidden behind
    confident styling.

### Visual language

63. `accent` and `destructive` communicate action and status only —
    never category. There is no categorical color palette in this system;
    a set of categories is distinguished by label and icon, not by hue
    (§1.1). Everything else renders in `foreground` at the opacity step
    its hierarchy calls for.
64. Icons communicate state or action. Decorative icons are prohibited.
65. Animation communicates a state change or spatial relationship, using
    a `duration-*` token (§1.7).
66. Entertainment animation is prohibited — no motion token exists for it.
67. Every animation resolves to `duration-instant` or off under reduced
    motion.
68. An existing token (§1) is used before a new one is proposed.
69. An existing component (§2) is used before a new one is proposed.
70. A new component requires a behavior none of the Primitives in §2 can
    express — documented in the PR description.
71. Route files compose Primitives; they do not invent design systems.
72. Hardcoded colors, radii, spacing values, font sizes, or durations in
    screen code are prohibited — every value must resolve to a token
    from §1.

### Accessibility

73. Every interactive element has an accessible name.
74. Every interactive element has a 44×44pt touch target.
75. Body text meets WCAG AA contrast against `background` at every
    `foreground` opacity step actually used for body copy — `foreground/38`
    is not legal for anything that must pass AA (metadata/timestamps
    only, never a reading paragraph).
76. Focus, pressed, disabled, loading, and error states are each
    distinguishable by more than an opacity step alone — pair opacity
    with a fill, `accent`/`destructive` line, or icon change (Rule 77).
77. Color is never the sole indicator of state (pair with icon, text, or
    shape).
78. Dynamic content has an accessibility announcement or a stable reading
    order.
79. The screen remains usable at the largest supported dynamic type size.
80. Horizontal scrolling is never required to discover a primary action.

### Native chrome

81. A native header slot (`headerLeft`, `headerRight`, search bar
    accessories) never toggles between a defined value and no value in
    response to interaction state. If a slot has nothing to show in some
    state, it renders an explicit alternate or empty view instead of
    `undefined`/`null` — the OS reserves the slot's space regardless, and
    may synthesize its own placeholder chrome for one that disappears. A
    real screen hit this: `app/(protected)/index.tsx` set `headerLeft` to
    `undefined` while its search bar was active, and iOS filled the
    reserved slot with a non-functional "More" button.
82. Chrome that only matters in one interaction state uses the platform's
    on-demand idiom for it (e.g. an expand-on-tap search field) rather
    than becoming permanently visible to sidestep a layout collision with
    other header content. Solve the collision; don't spend ceremony
    budget (§Ceremony budget) to avoid solving it.

---

## 4. Review gates

A screen fails review if:

- its purpose cannot be stated in one sentence;
- it has more than one `primary` button;
- it contains decorative copy;
- it contains a card, border, or background tint that a bigger gap or a
  heavier type token could have replaced (Ceremony budget, Rule 9, 10a);
- it contains a nested surface (Rule 10);
- it uses a value or pattern outside §1–§2 without a documented exception;
- it exposes implementation details by default;
- the first viewport does not show the task and the primary action;
- any required state (Rule 43) is missing;
- any visible control is invalid for the current state; or
- a reviewer cannot remove 20% of the UI without reducing functionality.

The governing rule:

> Every visual decision must improve comprehension, action, trust, or state
> visibility. Otherwise, remove it. Every value must come from §1. Every
> component must come from §2. Typography and whitespace are tried first;
> color, border, radius, and containers are the exception, not the
> vocabulary. There is no third option.
