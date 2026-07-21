# On-device calendar spike: date-query test drive

Goal: drive 15 date-related prompts through the on-device calendar spike, capture what the model actually did,
and judge whether the date-range resolution machinery added in this branch
(`claude/calendar-tomorrow-events-bug-8if6an`) holds up against realistic
professional usage — not just the "today" bug it originally fixed.

## Background

The spike (`app/(protected)/settings/on-device-calendar-spike.tsx` +
`modules/on-device-ai/ios/OnDeviceAIModule.swift`) lets an on-device
FoundationModels session answer calendar questions by calling a Swift tool,
`lookupCalendarEvents`, with three arguments:

- `startDate` / `endDate` — `yyyy-MM-dd`, inclusive. The **model** resolves
  whatever the user said ("today", "next week", "this time last month")
  into these concrete dates itself — the tool does no relative-date
  reasoning. It's told the current date (`todayAnchorString()`) in both its
  own description and the session instructions.
- `dayPart` — optional enum (`allDay` / `morning` / `afternoon` / `evening`
  / `night`). Swift owns the hour cutoffs (5am–12pm morning, etc.) via
  `Calendar`; the model just picks which bucket, if any, the user implied.

Swift then does exact day-boundary math (`Calendar.startOfDay`), so the
model can't get that part wrong — only which dates/dayPart to name.

The **thing being tested here**: whether the model reliably names the right
dates/dayPart for realistic phrasing, and where the design has known gaps
(recurring/day-of-week patterns, no-anchor fuzzy recall, multi-call
reasoning like comparisons).

## Prerequisites

1. An iOS device or iOS Simulator with **Apple Intelligence enabled**. On
   current macOS/Xcode versions, the simulator can run FoundationModels using
   the host Mac's Apple Intelligence model.
2. `EXPO_PUBLIC_ON_DEVICE_AI_SPIKE_ENABLED=true`, or a `__DEV__` build, so
   the Calendar row in Account settings is visible.
3. A test account can be created and authenticated programmatically. Use the
   test OTP `000000`; do not add a real password or credential to a flow. The
   calendar permission must be granted once in the simulator's system UI, then
   Account settings should show Calendar as `Connected`.
4. Seed a few real events on the device's default calendar spanning past and
   future dates — today, tomorrow morning, later this week, next week, a
   month ago, a Monday or two this month. Without seed data every answer
   will legitimately be "No events found," which still lets you check
   *date-range* correctness (see below) but tells you nothing about whether
   the final natural-language answer is sensible.
5. Java 17 for Maestro itself:
   ```bash
   export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
   export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
   ```

## Running it

The account and app session can be driven with Maestro. For a fresh session:

```yaml
appId: com.pontistudios.hakumi.dev
---
- launchApp
- tapOn:
    id: auth-email-input
- inputText: maestro.calendar.20260721@example.com
- tapOn:
    id: auth-send-otp
- extendedWaitUntil:
    visible:
      id: auth-otp-input
    timeout: 15000
- inputText: "000000"
- tapOn:
    id: auth-verify-otp
```

After authentication, open the spike from Settings and grant Calendar access
if the status is not yet `authorized`.

Note: despite what `apps/omiro/CLAUDE.md` says, `just mobile test` actually
runs the **vitest** suite (see `just/mobile.just`), not Maestro — there's no
`just` recipe for Maestro flows in this repo. Invoke the `maestro` CLI
directly from the repo root:

```bash
maestro test --debug-output ./maestro-debug apps/omiro/.maestro/on-device-calendar-date-queries.yaml
```

`--debug-output` gives you a predictable folder (`./maestro-debug/`) with a
screenshot per prompt (`01-what-do-i-have-today.png` ... `15-*.png`), plus
Maestro's own run log. Screenshots are the primary artifact here — the
flow has no content assertions, because model output is free-form and
non-deterministic by design. It only asserts that a response eventually
appeared (45s timeout per prompt; on-device generation with a tool call can
be slow).

If the app isn't installed yet, build and install first:

```bash
just mobile prebuild development
just mobile dev
```

## How to read each screenshot

Every screenshot shows the **"Processing steps" panel** above the response.
Look for the `Calendar query` row: it renders the model-derived range as

```
6:38:35 PM · Calendar query · —
Dates 2026-07-20 → 2026-07-20 · all day
```

Each row has the compact shape `time · step · duration`, followed by the
step detail. Calendar result rows show the EventKit lookup duration; response
rows show model-generation duration. A dash means the step is an
instantaneous marker rather than a timed operation.

**This line is the actual signal to evaluate** — it's what the model
resolved the prompt into, independent of what events happen to exist. The
final answer text below it reflects what EventKit returned for that range,
which only matters once the range itself is right.

If the panel scrolled out of frame in the screenshot, re-run just that case
interactively (open the app, type the one prompt, screenshot manually) — the
flow doesn't force-scroll to keep both panels in view.

## The 15 prompts and what "correct" looks like

Dates below are relative to whatever the device's current date is *at run
time* — this doc was written without knowing that date, so translate
"today" to the real value in each screenshot's `todayAnchorString()`
context (also visible in the session-start log line, which includes the
same anchor).

| # | Prompt | Expected resolution | Notes |
|---|--------|---------------------|-------|
| 1 | What do I have today? | `startDate = endDate = today` | Baseline — this is the exact case that was broken before this branch. |
| 2 | What's on my calendar tomorrow morning? | `startDate = endDate = tomorrow`, `dayPart = morning` | Tests date offset + dayPart together. |
| 3 | What do I have this week? | `startDate = today` (or start of week) through end of week, `dayPart = allDay` | Ambiguous whether "this week" means "from today" or "from Sunday/Monday" — either is defensible; note which the model picked. |
| 4 | Am I free Thursday afternoon? | `startDate = endDate` = the upcoming Thursday, `dayPart = afternoon` | Also tests whether the *answer* correctly inverts "what's free" from "what's booked" — the tool only returns busy events, so the model has to reason about gaps itself. |
| 5 | What's my next meeting? | A **wide-enough forward range** (e.g. today through +7 or +30 days) with the model picking the soonest event from the results | Not a date-range question per se — checks whether the model widens the search instead of assuming "today" only. |
| 6 | How many meetings do I have this week versus last week? | **Two tool calls**: one for this week's range, one for last week's | Tests multi-call reasoning. Watch for whether both calls appear in the log, or whether the model only calls once and guesses the second number. |
| 7 | What did I have going on this time last month? | `startDate ≈ endDate` = same day-of-month, one calendar month back | Tests backward-in-time resolution, not just forward. |
| 8 | What's on my calendar for the rest of the day? | `startDate = endDate = today` | Should behave like #1 — the tool has no way to filter to "from now until midnight" within a day since it's date-grained, not time-grained (outside of `dayPart`). Worth noting whether the model reaches for `dayPart` (e.g. `afternoon`/`evening` if asked in the afternoon) as an approximation, since there's no "from now" primitive. |
| 9 | Do I have anything conflicting with a 3pm call tomorrow? | `startDate = endDate = tomorrow` | Tests whether the model calls the tool at all rather than trying to answer without data — and whether "conflicting" reasoning happens correctly in the final text. |
| 10 | What's my first thing tomorrow? | `startDate = endDate = tomorrow` | Sanity check, should be reliable. |
| 11 | What do I have between now and Friday? | `startDate = today`, `endDate` = the upcoming Friday | Explicit range phrasing — should be easy. |
| 12 | Show me everything I have next week. | `startDate`/`endDate` spanning next week (Mon–Sun or +7 to +14 days) | Similar ambiguity to #3, one week further out. |
| 13 | What did I do the week I was out sick? | **No reliable anchor** — the model cannot resolve this from today's date alone | **Known limitation, not a bug to chase.** Interesting to observe: does the model hallucinate a plausible-looking date range anyway, ask a clarifying question, or decline? Any of the latter two is the "good" outcome; silently guessing a fake week is the failure mode worth flagging. |
| 14 | What's on my calendar every Monday this month? | **Not supported today** — `dayPart` has no day-of-week concept | **Known gap.** Expect the model to either (a) fall back to the whole month with no filtering and mention the limitation in its answer, or (b) fetch the whole month and manually filter Mondays out of the *returned event list* in its own reasoning (which would actually work, since the model sees full event timestamps in the tool's text output — worth checking if it does this without being told to). |
| 15 | How much free time do I have this afternoon? | `startDate = endDate = today`, `dayPart = afternoon` | Same "gaps not events" inversion as #4, narrower window. |

## What to do with the results

This isn't pass/fail — it's a scouting run. After reviewing the 15
screenshots:

1. **If `startDate`/`endDate`/`dayPart` resolution is consistently right**
   for 1–4, 7–12, 15 (the ones with a clear correct answer): the
   explicit-range + dayPart design is validated for the common case, no
   further tool-schema changes needed there.
2. **For #6 (comparison) and #5 (soonest)**: note whether the model
   naturally does the right thing with the existing tool shape, or needs
   either a system-instruction nudge or a dedicated tool. Don't add a new
   tool speculatively — only if the transcripts show it actually failing.
3. **For #13 and #14**: these are the two genuine design gaps identified
   before this test drive. Decide whether they're in scope for the spike
   (day-of-week filtering is a small, contained addition to `Arguments`;
   "no anchor" fuzzy recall is arguably out of scope — it needs event-content
   search, not date math) rather than building blind.
4. Report back with: which prompts resolved correctly, which didn't, and
   any transcript excerpts (the `tool_call` log lines) worth discussing
   before writing more Swift.
