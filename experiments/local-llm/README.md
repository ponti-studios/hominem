# Local LLM eval: on-device model quality vs. production baselines

Reliable eval system for comparing candidate on-device models (starting with
Gemma 4 E2B, the only Gemma 4 size
[react-native-executorch](https://github.com/software-mansion/react-native-executorch)
currently supports) against Omiro's real production prompts and current
production models — before investing in the mobile on-device integration
(native rebuilds, download UX, etc).

No app or API code is touched by any of this.

Built on [promptfoo](https://www.promptfoo.dev/). It was chosen over a
hand-rolled script because it gives us, for free: a provider matrix (same
test cases run against multiple models in one pass), deterministic
JavaScript assertions alongside model-graded `llm-rubric` scoring for
subjective checks like persona tone, caching, and a diff viewer — all things
a bespoke script would otherwise need to reinvent as this grows.

## Prereqs

- [Ollama](https://ollama.com) installed and running, with the model pulled:
  `ollama pull gemma4:e2b-mlx` (~6.5 GB).
- `OPENROUTER_API_KEY` set in your shell — used both to run the OpenRouter
  baseline models (`gpt-4o`, `gemini-2.5-flash-lite`, matching
  [packages/ai/src/shared.ts](../../packages/ai/src/shared.ts)'s current
  defaults) and as the judge model for `llm-rubric` assertions. Same env var
  name the API already uses (see `services/api/.env.example`).
- No install step otherwise — run everything via `npx promptfoo@latest`.

## Structure

```
promptfoo/
  prompts/        chat-style prompt templates (system + {{templated user turn}})
  assertions/      custom JS checks (JSON validity, field-omission/date-logic bugs, etc.)
  *.config.yaml    one config per prompt domain — providers + tests + assertions
```

Four domains, matching Omiro's actual production prompts:

- **chat-assistant** — [services/api/src/rpc/prompts/chat-assistant.md](../../services/api/src/rpc/prompts/chat-assistant.md), graded with `llm-rubric` (persona tone is subjective — this is the one place a model-graded judge earns its keep).
- **task-extraction** — [services/api/src/rpc/prompts/task-extraction.md](../../services/api/src/rpc/prompts/task-extraction.md), graded with deterministic JS assertions (task count, no fabricated tasks).
- **voice-task-extraction** — `services/api/src/rpc/prompts/voice-task-extraction.md`, graded with deterministic JS assertions encoding the priority-omission and noon-default rules.
- **voice-cleanup** — [packages/ai/src/voice-cleanup.ts](../../packages/ai/src/voice-cleanup.ts), graded with deterministic JS assertions (filler removal, meaning preservation).

## Run it

```sh
cd experiments/local-llm/promptfoo
npx promptfoo@latest eval -c chat-assistant.config.yaml
npx promptfoo@latest eval -c task-extraction.config.yaml
npx promptfoo@latest eval -c voice-task-extraction.config.yaml
npx promptfoo@latest eval -c voice-cleanup.config.yaml
```

Then open the diff viewer to compare model outputs side by side:

```sh
npx promptfoo@latest view
```

## Known bugs already encoded as assertions

A manual run on 2026-07-06 (see [results.md](./results.md) for the full
output) found two concrete defects in `gemma4:e2b-mlx`, both now encoded as
hard assertions in `assertions/voice-task-extraction.js` so they get caught
automatically on every future run, against every model:

1. Fabricates `"priority": "none"` instead of omitting the field when no
   urgency is stated.
2. Uses end-of-day (`23:59:59`) instead of the prompt's specified noon
   default for a date with no explicit clock time — inconsistently, since
   the same response got it right for a different task.

Every JSON response in that manual run also came back wrapped in ` ```json `
fences despite the prompt saying not to; `assertions/json-utils.js` strips
those before parsing, same as the original manual script did.

## Prompt iteration: v1 → v3 (2026-07-07)

Expanding test cases (7 → 20+ across the four domains) and running gemma
against the actual production baselines (`gpt-4o`, `gemini-2.5-flash-lite`,
`gpt-4o-mini`) surfaced findings well beyond formatting quirks — including
one bug that turned out to affect the production models too, not just
gemma. `prompts/task-extraction-v2.json` / `-v3.json` and
`prompts/voice-task-extraction-v2.json` / `-v3.json` are candidate prompt
revisions, A/B tested against the real production prompt (`v1-production`)
in the same config via promptfoo's multi-prompt matrix.

**`task-extraction`: fully solved by v3 — 15/15 passing, all three models.**

- v1 → v2: fixed gemma silently returning an empty task list for a
  single-item or implicit (non-"I need to"-phrased) actionable item — but
  introduced a regression, causing `gpt-4o` and `gemini` to start
  fabricating a task from a vague "maybe I'll repaint the room at some
  point" mention that v1 correctly ignored.
- v2 → v3: added one negative few-shot example distinguishing a vague
  someday-thought from a real low-urgency commitment, plus an empty-list
  example. Fixed the regression without losing the recall fix — clean win
  across all three models. **Ported into the real
  [task-extraction.md](../../services/api/src/rpc/prompts/task-extraction.md) prompt.**

**`voice-task-extraction`: real progress, but this domain shows the limits of prompt-only fixes.**

- v1 → v2: fixed the noon-vs-end-of-day default and the fabricated
  `"priority": "none"` value for gemma. Also revealed the noon-default bug
  independently affects `gpt-4o` on v1 — not gemma-specific, a genuine gap
  in the original prompt wording.
- Expanding to a 3-item mixed-urgency transcript found gemma **silently
  dropping one task out of three** — the most serious finding in this whole
  eval, since a missed task is invisible to the user rather than merely
  wrong. v2 → v3 added an explicit "low-priority tasks are not optional,
  never drop them" instruction plus a 3-item few-shot example. This fixed
  the drop (all 3 tasks now extracted), but introduced a smaller new
  defect: gemma started assigning a spurious `"low"` priority to a task
  that stated no urgency at all — trading a severe bug (missing task) for
  a mild one (wrong-but-present metadata). Also observed **run-to-run
  output variance from gemma at temperature 0** on a couple of cases,
  meaning the same input didn't always produce the same output locally —
  worth treating as a reliability question independent of prompt quality
  before shipping anything on-device.
- **Ported the validated, model-agnostic fixes into the real
  [voice-task-extraction.md](../../services/api/src/rpc/prompts/voice-task-extraction.md)
  prompt**: noon-default clarification, "don't drop low-priority items,"
  and stricter date-arithmetic wording. Did **not** port the "count items
  before responding" scaffolding verbatim from the eval prompt, since it's
  eval-specific and the underlying instruction is already captured in
  prose.

### A schema mismatch this exercise caught (now fixed)

Porting the eval's learnings back into production surfaced a real bug in
the eval itself, not the model: the eval's prompts and assertions used
`dueDate` and a `priority` enum of `low | medium | high | urgent`. The
actual production schema
([services/api/src/rpc/routes/tasks.ts](../../services/api/src/rpc/routes/tasks.ts))
uses **`dueAt`** and **`low | medium | high` — there is no `urgent` value**.

Fixed throughout: `prompts/voice-task-extraction*.json` (v1/v2/v3) and
`assertions/voice-task-extraction.js` now use `dueAt` and map
"urgent"/"ASAP"/"critical" to `"high"`, matching the real schema exactly.
Re-running after the fix reproduced all previously-documented findings
unchanged (including the run-to-run variance on `multi-mixed-urgency` for
gemma — it dropped a task on this run's v3 result, having only mislabeled
one on the previous run, same input, same temperature 0), plus one
newly-visible finding: v1's `"priority"` field failures now correctly read
as `"expected 'high', got 'urgent'"` — since v1 never defines an enum, an
unconstrained model just echoes the literal trigger word rather than
mapping it to a schema-valid value, which is precisely the gap v2/v3's
explicit mapping instruction closes.

### A methodology caveat worth keeping in mind

Production calls OpenRouter with schema-constrained structured output
(`createStructuredChatCompletion`), which forces `gpt-4o`/`gemini` to only
ever emit values that satisfy the Zod schema — they structurally cannot
emit `"none"` for an enum field or wrap output in markdown fences. This
promptfoo eval calls all providers, including the OpenRouter ones, via
plain unconstrained chat completion (no schema enforcement), so findings
like "fabricated `none`" or "wrapped in ` ```json ` fences" for `gpt-4o`/
`gemini` are likely **eval artifacts that wouldn't reproduce in real
production** for those two models. The findings that remain fully valid
regardless of schema enforcement are the ones schema constraints can't
fix: wrong-but-validly-shaped values (end-of-day instead of noon) and
undercounting (dropped tasks) — schema enforcement guarantees a date
string looks like a date and a tasks array looks like a tasks array, but
not that the date or the count is *correct*.

## Prior art

`eval-gemma4.ts` is the original hand-rolled version of this eval, kept for
reference. It's superseded by the promptfoo setup above for anything beyond
a one-off manual check.
