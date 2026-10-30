---
title: Web design direction
summary: Give agents a practical visual reference for bringing Hominem browser pages into the billing page's design language.
type: guide
status: active
owner: charlesponti
tags: [design, web, interface]
related: [authentication.md, billing.md]
updated: 2026-10-30
---

# Web design direction

Use the current Hominem billing page as the visual source of truth when restyling browser pages. Keep its editorial typography, open layout, black-and-white palette, fine rules, and direct controls. The account shell carries those same choices across profile, usage, connections, and data pages (`services/api/src/routes/billing/index.tsx:84-137`; `services/api/src/routes/login/app/account-shell.module.css:1-97`).

This direction governs presentation. A restyle keeps the page's existing route, navigation hierarchy, content, permissions, and behavior unless the user explicitly asks for those to change. A page may use a different composition when its task needs it; do not make every page a billing page or a grid of cards.

## The visual signature

- **Editorial, not dashboard chrome.** Let the page title, current task, and data establish hierarchy. Use generous whitespace and aligned content edges. Avoid a large stack of panels, decorative badges, or dashboard widgets that compete with the page's purpose.
- **Monochrome with a clear ink hierarchy.** Use white as the main ground, near-black for primary text and important actions, and a small set of neutral grays for supporting text, borders, and grouped data. The billing page uses `#0a0a0a` for ink, `#5c5c5c` / `#737373` for supporting text, `#e0e0e0` for rules, and `#f5f5f5` for a quiet data surface (`services/api/src/routes/billing/index.tsx:84-113`).
- **Type does the expressive work.** Hanken Grotesk carries the page title and readable content. JetBrains Mono marks compact metadata, uppercase section labels, navigation, and action text. The large title is medium-weight, tightly tracked, and fluidly sized; supporting labels are small, spaced, and restrained (`services/api/src/routes/billing/index.tsx:85-99`; `services/api/src/routes/login/app/account-shell.module.css:15-25`, `46-82`).
- **Structure comes from alignment and rules.** Use thin neutral dividers to separate page regions and stacked items. Keep content aligned to a shared max-width column and give each region room to breathe (`services/api/src/routes/billing/index.tsx:85-103`; `services/api/src/routes/login/app/account-shell.module.css:31-88`).
- **Use dark surfaces and metal textures sparingly and with meaning.** A solid near-black surface with white text can identify the current membership or make the primary action unmistakable. Keep ordinary content on white or pale neutral surfaces. Metallic textures are reserved for metal-named billing tiers, the complimentary Osmium membership, and Founding Core's iron-and-nickel planetary-core treatment. Give each membership a distinct, restrained material treatment inside its card, and preserve readable text and controls; do not use the texture as a general page background or decoration (`services/api/src/routes/billing/index.tsx:114-133`).

## Page composition

Start with the content's job, then compose it using the visual language above:

1. **Page header:** a short, direct title. Add one brief supporting sentence only when it explains a choice or consequence. Do not add a generic eyebrow or marketing introduction to fill space.
2. **Primary task or information:** place the most important control, status, or information directly after the heading. Give it a clear reading order and enough space to scan.
3. **Supporting sections:** separate related groups with spacing and a fine rule. Use a neutral panel when the content is a cohesive meter, comparison, or read-only summary; use plain rows or sections when content is navigational or form-based.
4. **Primary action:** use one clear primary action per decision point. Use supporting or destructive treatments only where the action's meaning requires it.

Keep the page specific. Account pages share a compact wordmark/header and a wrapping account navigation rail through `AccountShell` (`services/api/src/routes/login/app/account-shell.tsx:6-41`). That account navigation is not a universal application navigation component; retain each page's established navigation unless the task explicitly changes it.

## Type and spacing

- Use the installed Hanken Grotesk and JetBrains Mono fonts where they are already available. Check the owning app's font setup before adding or loading fonts.
- Make page titles large enough to anchor the screen, but keep them concise and close to the content that follows. The billing title uses a fluid `clamp()` size, tight negative tracking, and a compact line height (`services/api/src/routes/billing/index.tsx:94-99`).
- Use ordinary sentence case for titles and body copy. Reserve uppercase for short labels and action controls; use the mono face and tracking to distinguish those labels, not to make whole paragraphs shout.
- Use tabular numerals for counts, money, dates, and limits. Keep a value and its unit or limit together so a person can read them as one figure.
- Repeat spacing through a page rather than assigning unrelated margins to each item. Use wider gaps between major regions than within a control or row. At narrow widths, reduce outer padding before reducing text size.
- Keep body copy compact and useful. Avoid redundant descriptions, repeated current-plan labels, and captions that merely restate a visible value.

## Surfaces, borders, and controls

- Use a white main surface and subtle neutral dividers as the default. A pale gray rectangular panel works for grouped measurements and related read-only data.
- Keep ordinary form fields and action controls crisp, with a visible boundary and square or nearly square corners. The billing primary button is black with uppercase mono text and a minimum 44 px height; the secondary button keeps a white fill and black outline (`services/api/src/routes/billing/index.tsx:130-135`).
- Use a restrained corner radius only for cohesive membership/plan cards when it helps separate a selectable offer. Do not add a radius, drop shadow, pill, or border to every section by default.
- Use borders to show grouping or interaction boundaries. Avoid stacked borders around a section, its rows, and each value inside it.
- Keep hover, focus, disabled, loading, success, and error states legible. Preserve semantic colors where the app already defines them; monochrome styling must not make destructive or error states ambiguous.
- Make focus visible, controls keyboard-operable, and labels programmatically associated with inputs. Keep accessible names when a visible control uses only an icon or symbol.

## Data and usage

Present usage before commentary. For a capped count, put the count beside its limit; for a monthly allowance, show the percent used and remaining without exposing the underlying cost. Align the reading to the horizontal meter beneath it. Group related measures in one neutral panel and stack them as rows with dividers instead of creating a separate card for each metric. The account usage page puts the AI allowance first and MCP tool calls below it (`services/api/src/routes/billing/index.tsx`).

Use a simple gray track with a near-black fill for neutral progress. The bar must have an accessible label and a meaningful maximum/value. Pair it with the numeric reading; color or bar length alone is not enough. Omit a meter when the concept has no finite limit rather than showing a misleading full bar.

## Responsive behavior

- Preserve the desktop content width and left/right alignment; let the page use the available width below its maximum.
- At narrow widths, reduce page padding and let navigation, headers, and action rows wrap or stack. Never allow long labels or controls to force horizontal page scrolling.
- Stack multi-column content in its natural reading order. In the billing page, the usage panel becomes a single column and its heading stacks with reset metadata below 620 px (`services/api/src/routes/billing/index.tsx:137`).
- Keep buttons and touch targets comfortably operable, and make long emails, tokens, URLs, and identifiers wrap or scroll within their own bounded region.
- Check both a narrow phone viewport and a wide desktop viewport. Do not solve a mobile overflow by shrinking body text until it becomes hard to read.

## Restraint and exceptions

Do not add gradients, illustrations, motion, new accent colors, shadows, or decorative marks just to make a page feel more designed. First use spacing, type hierarchy, alignment, and one meaningful surface treatment. Metallic treatments on the billing membership cards are product-specific exceptions, not a license to add metallic or gradient styling elsewhere.

Do not copy the billing page's content hierarchy, account links, plan cards, or usage meters onto pages that do not need them. Match the visual language, not the page's information architecture. Keep page copy and controls concise, but do not remove information that is required to understand a decision or complete a task.

## Workflow for a page restyle

Give a Codex agent the target page or route and ask it to follow this sequence:

1. Read this guide and inspect the live billing reference in `services/api/src/routes/billing/index.tsx` plus the shared account shell in `services/api/src/routes/login/app/account-shell.module.css`.
2. Trace the target page's existing route, data, states, interactions, navigation, and responsive behavior before changing presentation. Preserve those contracts.
3. Identify existing components, theme values, and fonts in the target app. Reuse what exists; do not create a parallel palette or replace established application navigation as part of a visual pass.
4. Restyle the page with the editorial monochrome hierarchy. Keep the composition suited to its content and use no more components than the page needs.
5. Review loading, empty, error, success, disabled, and destructive states where the page has them. Verify keyboard focus, labels, contrast, and narrow-screen layout.
6. Format the changed files and run the owning package's required checks. Inspect the result in a browser at desktop and mobile widths when the app can run locally.

An effective task prompt is:

> Restyle `<route or page>` using `docs/web-design-direction.md` and the current billing page as the visual reference. Preserve its current routes, navigation, copy meaning, data, permissions, and interactions. Do not add new product behavior or information architecture. Inspect every page state, reuse the target app's existing components and font setup, and verify desktop and mobile layouts.

## Reference implementation

- Billing page structure, styles, usage panel, plan surfaces, controls, and responsive rules: `services/api/src/routes/billing/index.tsx:84-137`.
- Shared account header and account navigation: `services/api/src/routes/login/app/account-shell.tsx:6-41`.
- Shared account shell typography, neutral palette, width, rules, and mobile navigation: `services/api/src/routes/login/app/account-shell.module.css:1-97`.
- Existing account page form and token patterns: `services/api/src/routes/login/app/settings-page.module.css:4-127`, `148-235`.
