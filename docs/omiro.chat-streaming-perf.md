# Making chat streaming fast (what we tried, what stuck)

Notes from the omiro streaming-perf pass (PR #540, branch `feat/omiro-stream-perf`). Expo SDK 58 / RN 0.88, FlashList, dev build on an iPhone 17 Pro 26.5 simulator. If you're building a chat app with streamed replies, most of this applies to you too.

## The problem

A streamed reply shows up one word at a time. The naive version puts every new word into React state, which means every word:

1. re-renders the message row
2. changes that row's height
3. makes the list re-lay-out every row around it

Do that ~170 times for a 1k-char reply and the JS thread spends a ton of time on work that only needed to touch one `<Text>`. On a long reply it gets ugly (frozen frames).

## How we measured (do this first, seriously)

We didn't guess. We built a bench that replays a fake stream into the real UI:

- Deep link: `hakumi-dev://chats/<id>?bench=steady|burst|long&runs=N&t=<unique>`
- `steady` = 1 word / 25ms, `burst` = 12 words / 8ms, `long` = ~5x the text (~4.9k chars) at 2 words / 25ms. steady/burst are ~988 chars / 173 words.
- Logs one `[stream-bench] {json}` line per run. Metrics: React commit count + total commit ms + worst commit, JS fps, p50/p95/p99 frame gap, `jank33` (frames over 33ms), `frozen100` (gaps over 100ms), per-component render counts, time to first word, catch-up time after the last delta.
- Built from a React `Profiler`, a tiny `countRender()` helper, and a frame sampler (`services/perf/stream-perf.ts`).
- Raw runs live in `apps/omiro/performance/*.jsonl`.

Rules we learned the hard way:

- **Only trust same-session A/B.** A loaded laptop moves absolute numbers around a lot. Compare before/after back to back.
- **Run 3 times, sequentially.** Overlapping triggers corrupt the shared recorder. If a run shows 0 `StreamingMessageText` renders, relaunch the app, that run is bogus.
- **Have a long-reply scenario.** Some wins (and regressions) only show up at 5k chars.
- A dev build on a simulator is noisy. Good for relative comparisons, not for quoting fps to anyone.

## The pipeline (where each trick lives)

SSE `text-delta` → `handleChatGenerationEvent` → `paceStreamingText` (word-paced) → `appendStreamingText` → external store → `useSyncExternalStore` in the leaf `StreamingMessageText`. On `generation.committed` the real message lands in the cache and markdown takes over.

## What we tried, in order

| # | change | verdict |
|---|---|---|
| base | external store + word pacing (already shipped before the bench) | baseline: steady 131–133 commits / 110–123ms, burst 108–114 commits / 91–102ms |
| 1 | freeze finished paragraphs with `memo` | **reverted**, slightly worse on 1k and 5k chars |
| 2 | frame-paced (rAF) reveal | kept: neutral on steady, ~10% better on long, burst inconclusive |
| 5 | hoist `ItemSeparatorComponent` to module level | kept (cheap, free) |
| 6 | skip duplicate checkpoint writes | kept (not in the bench, has a unit test) |
| 3 | streaming bubble in `ListFooterComponent` | **kept, biggest win** |
| 4 | preload the markdown renderer | kept: first-open wait ~90–250ms → ~25–65ms, no bench effect |
| 9 | Reanimated `useAnimatedProps` | skipped, not needed after #3 |

### The numbers that matter

| | steady | burst | long |
|---|---|---|---|
| original | 131–133 commits, 110–123ms | 108–114 commits, 91–102ms | n/a |
| after #5 + #6 | 127–132 commits, 114–128ms, ~58.7fps | 112 commits, ~100–106ms | 549–556 commits, 468–582ms, max ~104ms, 1–2 frozen |
| **+ #3 footer** | **92–94 commits, 65–76ms** | **80–82 commits, 58–63ms** | **353 commits, 212–226ms, max ~9ms, 0 frozen, ~59.6fps** |

Long reply is the headline: commit time more than halved and the worst commit dropped from ~104ms to ~9ms, so no more frozen frames.

## Why each thing did (or didn't) work

**Footer bubble (#3, the big one).** While a reply streams, its height changes every word. As a list item, that makes the virtualized list re-lay-out every row. As the *footer*, it sits outside the data array, so rows never re-measure. Gotcha: only the **last** message can go in the footer. If an older reply is still draining under a newer message, putting it in the footer reorders the chat (Codex caught this in review). Anything else stays in the data in order.

**Frame-paced reveal (#2).** Pace words on `requestAnimationFrame` with a drift-free schedule (`dueAt = max(dueAt + delay, now)`), so a slow frame doesn't bunch words up. Chunk size scales with backlog (1/2/3 words), pause a bit on punctuation, and treat CJK per character since there are no spaces. Smoothness win more than a raw-throughput win.

**Paragraph memoization (#1).** Sounded great on paper: finished paragraphs shouldn't re-render. In practice splitting into paragraph components added more bookkeeping than it saved because the leaf `Text` was already cheap. Slightly worse at both sizes, so we ripped it out. Moral: the bench saved us from shipping a "clever" regression.

**Skip duplicate checkpoint writes (#6).** Every delta wrote the generation checkpoint to MMKV, mostly the same payload. A `lastWrittenCheckpoint` map (JSON-compared, cleared on persist/clear) drops the no-ops. Tiny, boring, correct.

**Preload markdown (#4).** We render plain `Text` while streaming and swap to markdown after commit. The markdown lib was lazy-loaded, so the first reply after a cold start waited on the import. Kicking `preloadMarkdown()` off at root layout mount hides it.

## What this means for your chat app

1. **Keep streaming text out of React state at the row/list level.** Put it in an external store and subscribe only in the leaf `Text` via `useSyncExternalStore`. Row and list should render a handful of times per reply, not once per word.
2. **Keep the in-flight message out of the virtualized list's data.** Footer (or an overlay) for the one that's growing. Watch ordering when multiple replies overlap.
3. **Plain text while streaming, markdown after.** Re-parsing markdown on every token is the classic way to melt a phone. Swap once on commit. Preload the renderer so the swap isn't late.
4. **Pace the reveal yourself.** Network deltas are bursty. Buffer and release on animation frames in word-sized chunks; it looks nicer *and* caps your commit rate. Handle CJK/no-space languages on purpose.
5. **Dedupe side effects per token.** Anything you do per delta (persist, log, analytics) should skip no-ops.
6. **Hoist list plumbing.** Separators, key extractors, and render callbacks should be stable, module-level where possible.
7. **Build the bench before optimizing.** A repeatable replay with commit counts and frame-gap percentiles turns arguments into numbers. Include a long-reply case, and expect some "obvious" wins to lose.
8. **Skip the exotic stuff until it's measured.** After #3 the JS thread had plenty of headroom; reaching for Reanimated or native text would've been complexity for nothing.

## Honest caveats

- Dev build, simulator, noisy machine. Trust the relative deltas, not the absolute ms.
- The bench replays text directly, so it bypasses the SSE client and the checkpoint store. #6 is covered by a unit test, not by the bench.
- We didn't eyeball every live-stream → committed handoff frame by frame, just a post-run screenshot and tests.
- Real devices (esp. older ones) will show bigger gaps; worth a pass on hardware before bragging.
