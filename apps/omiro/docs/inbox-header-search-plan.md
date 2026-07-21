# Inbox header + search redesign — outcome

Status: implemented.
Scope: `app/(protected)/index.tsx`, `components/ui/segmented-toggle.tsx`, `services/navigation/routes.ts`, `navigation/auth-route-guard.ts`, `config/auth.ts`.

## Why

The tab toggle (Chats/Notes/Tasks) and the native search bar were fighting for the same header row. Hiding the toggle whenever search activated (`headerLeft: isSearchActive ? undefined : ...`) left iOS 26 with an empty leading slot it didn't know what to do with, so it synthesized a non-functional "More" (•••) button — this is what surfaced as "the three-dot button does nothing."

## What we tried and ruled out

1. **`stacked` search placement** (search gets its own row, toggle never touches it) — worked, but trades away the native expand-on-tap idiom for a permanently-visible search row. Ruled out on ceremony-budget grounds.
2. **A native `UITabBarController` bottom tab bar** (`expo-router/unstable-native-tabs`), with a dedicated `role="search"` tab for cross-content search — technically the most "correct" native pattern for this exact structure, and it does eliminate the header-reconfiguration bug entirely (tabs live on a different layer than any header). Fully built and verified working. **Reverted**: not what was wanted — the tab switcher belongs in the header, not a bottom bar, regardless of which surface is more "native" in the abstract.
3. **A 2-way "This tab / All" scope pill replacing the toggle during active search** — this is what actually caused the bug. Root cause, confirmed by direct testing: it isn't `headerLeft` going `undefined` that breaks iOS 26, it's `headerLeft` changing *shape* (3 icons → 2 icons) between idle and search states, even with the config fully memoized. Any reshape of the leading slot — not just removing it — can trigger the native "More" ghost.
4. **Cross-tab ("All") search entirely** — dropped. It was a feature we invented while looking at what to put in the empty header slot, not an original requirement, and every way to expose it (scope pill, bottom tab) either reintroduced the bug or the surface we didn't want.

## What shipped

- **Icon-only toggle** — Chats/Notes/Tasks, using the custom PNGs at `assets/states/{chats,notes,tasks}-tab-icon.png` (`@2x`/`@3x` variants let Metro resolve the correct density automatically — the original `{name}.tab.{25,50,75}.png` naming didn't follow RN's scale-suffix convention and rendered 3x too large when briefly tried inside a native tab bar).
- **44×44pt tap targets** on every segment (`componentSizes.xl`), fixing a real pre-existing bug: the old toggle was `componentSizes.lg` (32pt) with no `hitSlop`, under Apple's HIG minimum.
- **Title repurposed** to show the active tab's name, replacing a permanently blank `title: ''`.
- **`headerLeft` is structurally invariant** — always the same 3-icon toggle, whether search is idle or active. It never resizes, never goes `undefined`, never swaps to a different component. That invariance is what actually fixes the bug — Rule 81/82 in `docs/03-experience.md` ("Native chrome") documents this generally.
- **Search stays per-tab only** — no cross-tab search feature. Each screen's search bar searches only its own content, same as before this whole investigation started.
- **Bible updates preserved**: Foundations §1.6 (Iconography — solid alpha-mask custom icons, tinted like SF Symbols), the Segmented toggle primitive's icon-variant + explicit sizing contract, and Patterns §"Native chrome" (Rules 81–82) all remain accurate to this outcome and needed no changes when the scope-pill/bottom-tabs ideas were reverted.
