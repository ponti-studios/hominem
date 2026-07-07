# Results: gemma4:e2b-mlx, 2026-07-06

Run via Ollama on Apple Silicon (arm64), model `gemma4:e2b-mlx` (6.5 GB).

## Summary verdict

Promising for a 2B-effective-parameter on-device model — persona and
task/non-task discrimination are both real, not superficial. Two concrete
prompt-adherence bugs would need fixing (via `format: "json"`, few-shot
examples, or a validation layer) before this could back a real feature:

1. Fabricates `"priority": "none"` instead of omitting the field when no
   urgency is stated in the transcript.
2. Inconsistent due-date default — "today" got `23:59:59` in one case, but
   "next Friday" in the *same response*, and a separate case, both correctly
   got `12:00:00` (noon), which is what the prompt actually specifies for a
   date with no explicit clock time.

Every JSON response was wrapped in ` ```json ` fences despite the prompt
saying "return only the JSON" — a known small-model habit. The eval script
strips fences before parsing, but production code calling Ollama directly
would need to do the same, or use the `format: "json"` request parameter
(untried in this run) to get fence-free output at the decoding level.

## Raw output

### chat-assistant: user proposes a bad idea (day-trading crypto)
(13548ms)

> Quit your job? Seriously?
>
> You're basing a life decision on two weeks of luck. That "doing well" is noise, not a sustainable strategy.
>
> Here's the reality you're ignoring: Most people lose money day trading. Quitting your income stream for a gamble is not a strategy; it's a high-stakes roulette spin. You'll burn through your capital fast, and when the inevitable crash happens—and it always does—you won't have a safety net to fall back on.
>
> Stop focusing on the wins and start calculating how much you can afford to lose while you still have something to live on. That's not trading; that's gambling with your future.

**Read**: strong persona match — blunt, leads with the answer, calls out the bad logic directly.

---

### chat-assistant: user asks a straightforward question (Postgres vs MongoDB)
(5071ms)

> Use Postgres.
>
> MongoDB is for things that don't care about structure or ACID compliance. If you need relational data and strong consistency, you use SQL. Period.

**Read**: terse, confident, no hedging — matches the "best friend of 30 years" tone spec.

---

### task-extraction: multiple tasks in a conversation
(3896ms)

```json
{
  "tasks": [
    { "title": "Email the landlord about renewing the lease" },
    { "title": "Call the dentist to reschedule cleaning" }
  ]
}
```
`[JSON: valid]`

**Read**: correctly dropped "maybe repainting the living room at some point" as
non-actionable (vague, no clear outcome) — exactly the discrimination the
prompt asks for.

---

### task-extraction: no actionable items
(2677ms)

```json
{ "tasks": [] }
```
`[JSON: valid]`

**Read**: correct — pure reflection/discussion, no tasks invented.

---

### voice-task-extraction: relative date + explicit urgency
(10564ms)

```json
{
  "tasks": [
    {
      "title": "Email landlord about lease renewal",
      "description": "Email the landlord regarding the lease renewal.",
      "priority": "urgent",
      "dueDate": "2026-07-06T23:59:59-07:00"
    },
    {
      "title": "Call dentist",
      "description": "Remind the user to call the dentist.",
      "priority": "none",
      "dueDate": "2026-07-11T12:00:00-07:00"
    }
  ]
}
```
`[JSON: valid]`

**Read**: urgency correctly detected ("urgently... today" → `urgent`). But:
- `"today"` resolved to end-of-day (`23:59:59`) instead of noon — inconsistent
  with the prompt's stated noon-default rule.
- Dentist task had no stated urgency ("no rush" was explicitly said, actually —
  arguably should have been `"low"` or similar, not omitted *or* `"none""`;
  worth a closer look) but the model emitted `"priority": "none"` rather than
  omitting the key as instructed.

---

### voice-task-extraction: date with no explicit time (noon default)
(6935ms)

```json
{
  "tasks": [
    {
      "title": "Submit tax documents",
      "dueDate": "2026-07-10T12:00:00-07:00"
    }
  ]
}
```
`[JSON: valid]`

**Read**: correct — single task, correct noon default, `priority` field
correctly omitted entirely (no urgency stated). This is the same rule that
was violated in the previous case, so behavior is inconsistent rather than
uniformly wrong.

---

### voice-cleanup: messy filler-heavy transcript
(5689ms)

```json
{
  "cleanedText": "I need to pick up the dry cleaning tomorrow and also call John about the meeting on Thursday. I think it's at 3 PM."
}
```
`[JSON: valid]`

**Read**: filler words stripped, casing/punctuation fixed, meaning preserved.
Minor: trimmed "I think... or something" hedging slightly more than
"don't summarize/paraphrase" strictly allows — a nitpick, not a defect.

## Next step

Re-run with Ollama's `format: "json"` parameter set, to see whether
constrained decoding also fixes the field-omission and date-default
inconsistencies (structured decoding sometimes changes what the model
considers "close enough" to emit), before making a final go/no-go call on
the mobile integration.
