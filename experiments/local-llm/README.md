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

## Prior art

`eval-gemma4.ts` is the original hand-rolled version of this eval, kept for
reference. It's superseded by the promptfoo setup above for anything beyond
a one-off manual check.
