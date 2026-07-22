# Tech Debt Audit — apps/omiro
Generated: 2026-07-21 · Updated: 2026-07-21 (added F014 from code-smell-detector pass)
Scope: `apps/omiro` only (191 TS/TSX files, ~18k LOC)
Tooling used: `knip`, `madge --circular`, `depcheck`, `vitest run`, `rg`/`grep`, `git log`
Companion passes: `deslop` (scoped to the 7 uncommitted working-tree files) found no AI-slop artifacts — see note below. `code-smell-detector` (Fowler catalog heuristics) contributed F014.

## Executive summary

- No `any`/`unknown` type escapes anywhere in the app — genuinely clean type discipline (see "looks bad but fine").
- 19 files use raw `StyleSheet.create` instead of the required `makeStyles`/`theme` pattern from [CLAUDE.md](../../CLAUDE.md), including 8 of the 9 files under `components/ui/` — the convention is the exception, not the rule, in that directory.
- `components/chat/chat-message.tsx:334` (637 LOC, the largest file in the app) exports a `ChatMessage` component that nothing imports; only its sibling `renderChatMessage` function is actually used.
- `services/chat/use-chat-archive.ts:68` re-exports its own hook under a second name (`useArchiveChat = useChatArchive`) that nothing imports.
- `components/theme/theme.ts` exports the same `theme` object two ways (named `theme` and `export default theme`), inviting import-style drift.
- Genuine circular dependency: `services/tasks/taskVoiceCapture.helpers.ts` ↔ `services/tasks/use-task-voice-capture.ts`.
- 3 dependencies (`expo-blur`, `expo-glass-effect`, and likely `expo-updates`) have zero references anywhere in the app.
- Test coverage is thin relative to app size: 15 test files for 191 source files (~8% file coverage), concentrated in `services/`; `components/` and `app/` routes have almost none.
- No `knip.json` exists, so knip's default config misreads all 15 real, passing test files as "unused" — a tooling gap, not real dead code (verified by running `vitest run`: 15/15 files, 54/54 tests pass).
- 0 `console.log`, 0 `TODO`/`FIXME`/`HACK` left in the tree — clean of debug/deferred-work residue.
- **NEW**: `hooks/use-chat-controller.ts:129-477` — `useChatController` is a single 349-line function. Of every long-*file* flagged below (F010–F013), this is the one long-*method* finding severe enough to call out on its own: one hook, one closure, 349 lines.

## Architectural mental model

Omiro is an Expo Router app (file-based routes under `app/`, `(auth)`/`(protected)` groups) backed by a `services/<domain>` layer (auth, chat, inbox, tasks, notes, navigation, query, files) that wraps RPC calls and local caching/state, consumed by `components/<domain>` screens and `hooks/`. Native functionality (on-device AI, voice transcription, iOS intents) lives in `modules/` as Expo native modules. The app recently went through a navigation restructuring (`feat(navigation): Implement Omiro Workspace Navigation Model`, per git log) that renamed `components/workspace/*` to `components/inbox/*` — the old directory is fully gone, so that migration appears complete and left no orphaned duplicate directory, though some of the findings below (dead `ChatMessage` export, circular task-voice-capture dependency) look like residue from around the same period given they sit in high-churn files.

## Findings

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|-----------------|
| F001 | Architectural decay | `components/chat/chat-message.tsx:334,483` | Medium | S | `ChatMessage` component (part of a 637-line file) is exported but has zero importers anywhere in the app; only `renderChatMessage` (same file) is used | Delete the `ChatMessage` component and its `export { ChatMessage }` line if truly unused, or inline it into `renderChatMessage` if it was meant to replace the render-prop pattern |
| F002 | Architectural decay | `services/chat/use-chat-archive.ts:68` | Low | S | `useArchiveChat` is a dead alias (`export const useArchiveChat = useChatArchive`) with no importers | Delete the alias export |
| F003 | Architectural decay | `services/tasks/taskVoiceCapture.helpers.ts` ↔ `services/tasks/use-task-voice-capture.ts` | Medium | S | Genuine circular dependency: helpers file imports `TaskVoiceCaptureErrorCode` type from the hook file, which imports the helpers file | Move the shared `TaskVoiceCaptureErrorCode` type into a third file (e.g. `taskVoiceCapture.types.ts`) both can import from |
| F004 | Consistency rot | `components/theme/theme.ts:38,59` | Low | S | `theme` is exported both as a named export and as `export default theme` | Pick one export style repo-wide (CLAUDE.md already says "Use `makeStyles` and `theme` from `~/components/theme`" — codify as named-only) |
| F005 | Consistency rot | 19 files incl. 8/9 of `components/ui/*` (`button.tsx`, `input.tsx`, `icon.tsx`, `segmented-toggle.tsx`, `swipe-action.tsx`, `EmptyState.tsx`, and 13 others — full list gathered via `rg -l "StyleSheet.create"`) | High | M | CLAUDE.md requires `makeStyles`/`theme`, forbidding raw `StyleSheet.create` with hardcoded values, but it's used in most of `components/ui/`, several `app/` route files, and `components/chat`, `components/media`, `components/error-boundary`, `components/protected` | Either migrate these to `makeStyles`, or if `StyleSheet.create` is intentionally acceptable for static/non-themed styles, update CLAUDE.md to state the actual rule — right now code and doc disagree |
| F006 | Dependency debt | `apps/omiro/package.json:37,46` | Low | S | `expo-blur` and `expo-glass-effect` are declared dependencies with zero references in source or `app.config.ts` plugins | Remove from `package.json` if confirmed unused, or restore the intended usage |
| F007 | Dependency debt | `apps/omiro/package.json:64` | Low | S | `expo-updates` has zero JS references; EAS Update is configured natively through `app.config.ts` | Confirm with the team whether `expo-updates` is required as a native dependency for EAS Update even without a JS import — see open questions |
| F008 | Test debt | `apps/omiro/` (no `knip.json`) | Low | S | Default knip config doesn't recognize `tests/**/*.test.ts` as entry points, so it reports all 15 real test files (54 passing tests) as "unused files" | Add a minimal `knip.json` with `"entry": ["tests/**/*.test.ts", ...]` so future knip runs don't produce false dead-code positives |
| F009 | Test debt | `apps/omiro/tests/` vs `apps/omiro/components/`, `apps/omiro/app/` | Medium | L | 15 test files exist, essentially all under `tests/services/`; `components/` (the largest source directory, including all god files below) and `app/` routes have no corresponding unit tests | Add tests for the highest-churn, highest-LOC files first (see F010–F013) before further feature work touches them |
| F010 | Architectural decay | `components/chat/chat-message.tsx` | Medium | M | 637 LOC, largest file in the app; mixes action-icon buttons, edit modal, tool-call rendering, referenced-notes rendering, debug rendering, and the message component itself | Split by responsibility (e.g. `MessageEditModal`, `MessageToolCalls`, `ReferencedNotes` into separate files) — several are already function-per-concern internally, so extraction is mostly a file move |
| F011 | Architectural decay | `components/inbox/NoteDetailScreen.tsx` | Medium | M | 619 LOC | Same as F010 — audit for extractable sub-components |
| F012 | Architectural decay | `app/(protected)/settings/index.tsx` | Low | M | 541 LOC, and the single most git-churned file alongside `app.config.ts` (20 commits in 6 months) — high churn + high size is the classic debt-concentration signal | Worth a closer look at whether settings sections can be split into sub-components before the next round of changes |
| F013 | Architectural decay | `app/(auth)/verify.tsx` | Low | M | 484 LOC for an OTP verification screen | Audit for extractable pieces (timer/resend logic, error presentation) |
| F014 **NEW** | Long method | `hooks/use-chat-controller.ts:129-477` | High | M | `useChatController` is implemented as a single 349-line function — state management, side effects, and API orchestration all in one closure. This is the most severe long-method smell in the app, distinct from F010–F013 which are long *files* with multiple smaller functions | Split into smaller hooks by responsibility (e.g. `useChatMessages`, `useChatSendState`, `useChatStreamSync`) composed inside `useChatController` |
| F015 **NEW** | Long method | `app/(auth)/verify.tsx:74-379` (`VerifyScreen`), `app/(protected)/settings/index.tsx:130-420` (`Settings`), `components/inbox/NoteDetailScreen.tsx:203-458` (`NoteEditorBody`) | Medium | M | Same file-size signal as F011–F013, but confirmed at the function level: each of these files' size comes from one dominant 250–300-line function, not several medium ones | Same recommendation as F010/F011 — extract by responsibility; the single-function shape makes these easier to split than files with many small functions |

## Top 5 — if you fix nothing else, fix these

1. **F014 — Split `useChatController` (349-line single function).** Promoted to #1 after the `code-smell-detector` pass confirmed this isn't just a large file (like F010–F013) but a single closure doing state, side effects, and API orchestration together — the sharpest Single-Responsibility violation in the app and the riskiest to keep extending as-is.
2. **F005 — Resolve the `StyleSheet.create` vs `makeStyles` conflict.** High-severity because it's a repo-rule violation at scale (19 files), not an isolated smell, and it's exactly the kind of drift that compounds — every new file copy-pasted from one of these 19 perpetuates it. Either enforce the rule with an oxlint custom rule / codemod, or correct CLAUDE.md if raw `StyleSheet.create` is actually fine for non-themed styles.
3. **F009 — Add tests before touching `components/`.** The directory holding every god file/method in this audit (F010–F015) has zero test coverage. Any refactor of F014/F011 without tests first is refactoring blind.
4. **F001 — Delete the dead `ChatMessage` export.** Concrete, 5-minute fix, and removes ambiguity in the app's largest file about which of two similarly-named things (`ChatMessage` the component vs. `renderChatMessage` the function) is the real API.
5. **F003 — Break the circular dependency.** Small fix, but circular deps between a hook and its own helper file are a common source of subtle initialization-order bugs in RN/Metro bundling.

*(F006/F007 — unused Expo packages — remains a worthwhile quick win, just displaced from the top 5 by F014.)*

## Quick wins

- [ ] F001: Delete unused `ChatMessage` export in `chat-message.tsx`
- [ ] F002: Delete unused `useArchiveChat` alias in `use-chat-archive.ts`
- [ ] F003: Extract `TaskVoiceCaptureErrorCode` to break the circular import
- [ ] F004: Drop the duplicate `default` export from `theme.ts`
- [ ] F006: Remove `expo-blur` and `expo-glass-effect` if confirmed unused
- [ ] F008: Add `knip.json` with correct test entry points

## Companion skill runs

- **`deslop`** (2026-07-21), scoped to the 7 files with uncommitted working-tree changes at the time (`.maestro/inbox-search.yaml`, `app/(protected)/_layout.tsx`, `components/inbox/InboxList.tsx`, `components/navigation/WorkspaceContextPicker.ios.tsx`, `components/navigation/WorkspaceToolbar.ios.tsx`, `components/tasks/TasksPane.tsx`, `components/ui/EmptyState.tsx`): no AI-slop artifacts found (no stray comments, no abnormal try/catch, no `as any`, no style drift within those files). This doesn't cover the rest of the branch diff (96 files vs. `main`), only the working tree at scan time.
- **`code-smell-detector`** (2026-07-21), Fowler-catalog heuristic scan of `apps/omiro`: contributed F014/F015 (long methods). Checked for long parameter lists, switch-statement smells, primitive obsession, and lazy classes — none material. The 7 `switch` statements in the app are idiomatic `useReducer` reducers or discriminated-union handling, not the type-code-as-polymorphism smell the catalog targets, so they weren't flagged.

## Things that look bad but are actually fine

- **`components/workspace/*` appearing in 6-month git churn history but not existing on disk.** This looked like it might be a stale duplicate directory left over from the recent navigation refactor. It's not — `git log --name-only` shows historical commits touching files that were later renamed to `components/inbox/*`; the directory itself is gone. Nothing to clean up here.
- **`expo-camera`, `expo-notifications`, `expo-splash-screen`, `expo-dev-client`, `expo-build-properties` flagged as "unused" by `depcheck`.** All five are referenced by name inside the `plugins` array of `app.config.ts` rather than imported in JS, which `depcheck` can't see. Confirmed real usage; not unused.
- **`babel-preset-expo` flagged as an unused devDependency by `depcheck`.** It's referenced by string in `babel.config.js`'s `presets` array, not imported. In active use.
- **Zero `any`/`unknown`/`as any` in the entire app.** Initially suspicious for an app this size — usually a sign that type errors are being suppressed some other way (e.g. `// @ts-ignore` or a loose `tsconfig`). Spot-checked: no `@ts-ignore`/`@ts-expect-error` sprawl found either. This appears to be genuinely disciplined typing, not a blind spot in the scan.
- **Only 25 `try/catch` blocks across 191 files.** Low count could mean swallowed errors elsewhere, but a spot check didn't turn up blanket catches or silently-dropped errors — the count is just consistent with an app that mostly lets React Query / RPC error boundaries handle failures rather than local try/catch, which is a reasonable pattern here.

## Open questions for the maintainer

- Is `expo-updates` (F007) required as a native dependency for EAS Update to function even though nothing imports it in JS, or is it safe to remove? This audit can't distinguish "native-only dependency" from "actually dead" with static analysis alone.
- Is the `StyleSheet.create` usage in `components/ui/*` (F005) intentional (e.g., these are meant to be theme-independent low-level primitives) or is it drift from before `makeStyles` existed? The answer changes whether F005 is a bug or a doc-accuracy problem.
- Are `components/chat/chat-message.tsx`, `components/inbox/NoteDetailScreen.tsx`, `app/(protected)/settings/index.tsx`, and `app/(auth)/verify.tsx` (F010–F013) considered acceptable size for this codebase, or is there an appetite for splitting them? This audit flags size + churn as a debt signal but doesn't have the product context to say the split is worth the risk right now.
