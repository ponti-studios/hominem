# Eval report

Run on 2026-09-19T17:50:19.750Z.

- Evals: career-job-import.eval.ts, chat-assistant.eval.ts, mcp-tool-selection.eval.ts, offer-extraction.eval.ts, task-extraction.eval.ts, time-block-holdout.eval.ts, time-block-regression.eval.ts, voice-cleanup.eval.ts, voice-task-extraction.eval.ts
- Models compared: openai/gpt-4o-mini
- Agent runs: 104
- Tests: 1 passed, 10 failed

## Models

| Model              | Runs | Failed runs | Correctness   | Served by  | Avg latency |         Cost |
| ------------------ | ---: | ----------: | ------------- | ---------- | ----------: | -----------: |
| openai/gpt-4o-mini |  104 |           0 | 40/104 passed | unmeasured |     2021 ms | $0.028214850 |

Correctness is a ratio over the runs that were graded, not over every run. The failures column answers the other question, whether the model answered at all: a model can answer perfectly and still be marked wrong, and it can fail outright without ever being judged. A run that died before it produced an answer is counted as a failure and left out of correctness entirely, because a rate limit or a rejected credential says nothing about the model's quality; a model whose every run died reads `unmeasured` rather than zero.

## Tests

| Test                                   | Result |  Duration |
| -------------------------------------- | ------ | --------: |
| career job import                      | fail   | 100022 ms |
| chat assistant                         | fail   |  19745 ms |
| MCP tool selection                     | fail   |   6381 ms |
| offer extraction                       | fail   | 317679 ms |
| task extraction                        | pass   |  16477 ms |
| time block holdout                     | fail   |  27998 ms |
| time block regression                  | fail   | 218717 ms |
| voice cleanup                          | fail   |  17893 ms |
| voice task extraction (prompt-v1.json) | fail   |  26134 ms |
| voice task extraction (prompt-v2.json) | fail   |  25190 ms |
| voice task extraction (prompt-v3.json) | fail   |  27377 ms |

## Failures

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.6 is below the minimum 0.7. The judge wrote: The salaryDetails field is truncated and does not contain the full text from the source posting, which violates the requirement that all sourced fields must be准确完整. All other fields are partially correct but the incomplete salaryDetails disqualifies the output from passing the criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate answer is not concise, does not provide the clear conclusion and essential reason as required, and includes unnecessary padding. It fails to match the reference output and the specified format.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.2 is below the minimum 0.7. The judge wrote: The answer exceeds the required one or two concise sentences and adds extra padding about MongoDB, violating the concise format requirement.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate response contains three sentences and does not present the essential reason in the second sentence as required. It also includes additional, non-essential content, violating the concise two-sentence rule.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The answer exceeds the required one or two concise sentences, adding an extra explanatory sentence that is unnecessary and violates the brevity criterion.
```

**openai/gpt-4o-mini** was judged failed:

```
expected tool "get_career_portfolio" to be called, but it was not. Tools called: trip_history, place_visit_history
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate incorrectly set employmentType to "employee", which is not present in the source notes; reference expects null.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, hasBonus, employmentType.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.8 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: The candidate output incorrectly sets the equityType to "rsu" whereas the reference specifies equityType as null. This invented value violates the requirement to avoid inventing data not present in the source or reference.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output contains invented values for hasRelocation, employmentType, and homeCity which are not present in source notes; these should be null.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output incorrectly sets hasRelocation to null instead of false as specified in the reference. This omission violates the requirement to include every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.96 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: The candidate incorrectly set the person.homeCity to "austin" while the reference specifies it should be null. All other fields match the reference exactly.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes invented values for hasRelocation (false instead of null) and homeCity (new-york instead of null). These fields are null in the reference, so the output does not match the required data and violates the criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate incorrectly set the person's homeCity to "tokyo", a value not present in the source notes. This violates the requirement to include only stated facts and to leave unspecified fields as null.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate incorrectly sets 'hasRelocation' to false for both offers (should be null as no relocation info was provided). This invented value violates the rule to set missing fields to null and results in a failed assessment.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.4 is below the minimum 0.7. The judge wrote: Candidate output deviates from the reference: the location string not exactly matching (uses hyphen instead of space) and it incorrectly assigns a non‑null employmentType value (‘employee’) when the reference has it null. These discrepancies violate the requirement to match all stated facts and not include invented values.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output contains an additional field person.homeCity set to "toronto", whereas the reference specifies this field as null. This discrepancy means the output does not match the reference semantics, violating the requirement to include every stated fact exactly as given.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing or incorrect hasRelocation value; candidate has null but reference expects false.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.7 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: The candidate output incorrectly assigns the person's homeCity as "new-york" instead of null, contradicting the reference output. All other fields match the reference, but this single mismatch results in a failing verdict.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate's bonusTargetPct is 16.67, while the reference expects null (sign‑on bonus should not set a percentage). This invented value violates the criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output does not match the reference. It incorrectly sets baseSalary to 297,500 USD instead of 350,000 with null currency, and leaves requiresVisa null instead of false. These omissions and invented values violate the evaluation criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes values for requiresVisa, employerCoversVisa, and employmentType that are not present in the reference output; these fields should be null as per reference. Therefore the output does not match the reference semantically.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing hasRelocation value; should be false as per reference.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly assigns values to fields that should be null according to the reference: hasBonus is set to false instead of null, hasRelocation is set to false instead of null, and employmentType is set to "employee" instead of null. These deviations violate the requirement to match every stated fact exactly.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: homeCity incorrectly set to london; should be null as not stated.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate added scheduling_window_start and scheduling_window_end values that were not present in the reference output; these fields should be null as they were not established by the request.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: Scheduling window start and end dates are incorrect; they do not match the next week timeframe specified in the request.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output omitted the participant "Mia" and used a different timezone offset (-07:00) than the reference (-08:00). The reference expects the participant list to be present and the timezone to match the input context. Therefore the candidate does not meet the required fields.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes scheduling_window_start and scheduling_window_end, which are not present in the reference output and are not required by the request. This violates the rule to keep fields null when not established.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Scheduling window dates do not match reference; candidate incorrectly set to 2026-07-25-26 instead of 2026-07-27-28.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: The candidate matches intent, duration, participants, deadline, recurrence, and target event, and the title difference is harmless. However, it invents start_time and end_time fields that are null in the reference, violating the requirement to keep fields null when not established by the request. Thus the output does not fully match the reference.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.92 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: Missing participants field; title omitted time details but considered harmless.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing participants and invented scheduling window fields.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Deadline mismatch and invented scheduling window; candidate does not match reference.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Incorrect intent (add_task vs add_event), invented scheduling window values, and missing temporal grounding; title difference is acceptable but does not compensate for these errors.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing participants and incorrect temporal grounding; start and end times do not match the corrected Friday 2 PM time.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output provides specific start_time and end_time values, which were not established by the user’s request. The reference output leaves these fields null, indicating that no specific temporal grounding was inferred. Since the candidate invented values beyond what was requested, it violates the requirement to keep unspecified fields null and is therefore not correct.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate added a duration value (60) that was not specified in the request; the reference had null for duration. This invention violates the criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.67 is below the minimum 0.7. The judge wrote: The candidate output fails to include the participant "Alex", invents a duration of 60 minutes where none was specified, and provides incorrect start and end times (2026-08-03 instead of the reference 2026-07-30). These discrepancies violate the required fields and temporal grounding, leading to a failure.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes scheduling_window_start and scheduling_window_end values, which are not established by the user request and are not present in the reference output. According to the criteria, such invented fields should be null, so the candidate fails the evaluation.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output invents scheduling_window_start and scheduling_window_end, which are not established by the request, and provides a deadline_fixed of 2026-07-29, whereas the reference specifies 2026-07-31. These deviations violate the requirement to keep unspecified fields null and to avoid invented or superseded values.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: Candidate output invented scheduling_window_start and scheduling_window_end values that are null in the reference output, violating the requirement to keep fields null when not established by the request.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Target title and duration differ from reference; duration invented.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output does not match the reference: it provides a duration (60) where the reference has null, and sets start_time and end_time to 2026-07-29T14:00:00-07:00/15:00:00-07:00 instead of the reference 2026-07-31T14:00:00-07:00/15:00:00-07:00.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: Candidate incorrectly set scheduling_window_start and scheduling_window_end; these should be null as not established by request.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes an invented duration (60) which was not specified in the request, and the recurrence_rule contains an unnecessary 'RRULE:' prefix, deviating from the reference. Title wording differences are acceptable, but these other discrepancies cause the output to fail the criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Title differs from the user request; start_time and end_time are invented, not explicitly requested by user, thus infringing criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly sets the intent to "schedule_gap_fill" and invents scheduling window bounds, whereas the user’s request is a simple query about scheduled events after lunch. The correct intent should be "search" with all other fields null, matching the reference output. The candidate therefore fails the criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output has a different primary intent ('add_task' vs expected 'add_event') and introduces invented fields (duration and scheduling window) that were not specified in the request, violating the requirement to keep unspecified fields null and not invent values.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate invented title, location, start_time, and end_time which were not specified in the request; reference expects null for these fields.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output invents duration, start_time, and end_time, which were not specified by the user and should remain null. Additionally, the target_title differs from the reference (it should be the user’s input).
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes non‑null values for scheduling_window_start and scheduling_window_end, which were not specified in the reference output or the user request. According to the criteria, any fields not established by the request must remain null, and invented values are penalized.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes non‑null scheduling_window_start and scheduling_window_end fields, which were not specified in the user request and are not present in the reference output. According to the criteria, any invented or superseded values for fields not established by the request should be penalized, resulting in a failure.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output represents the invoice number and due date in words instead of digits, violating the requirement that numbers and dates remain intact.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output contains filler words and additional phrases (“Um, so like”, “also”, “I think it’s at like 3 PM or something”) that are not present in the reference cleaned text. These additions violate the requirement to remove filler and repeated speech fragments, resulting in a mismatch with the reference.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate’s due date (2026-07-15) does not match the reference due date (2026-07-10).
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output fails to match the reference on several critical aspects: the priority for the first task is 'urgent' instead of 'high'; the due date for the first task is 09:00 instead of the required noon default; the second task has an incorrect due date (2026-07-15 instead of 2026-07-10) and lacks the required low priority. These discrepancies mean the candidate does not meet the evaluation criteria.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output does not match the reference: it uses an invented priority value "ASAP" for the restart task instead of the required "high", and it omits the priority values for the read and groceries tasks. Additionally, it adds description fields that are not present in the reference. These discrepancies violate the criteria for correct urgency and completeness.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.3 is below the minimum 0.7. The judge wrote: The candidate omitted the dueAt field for the dentist task, which does not match the reference. The title change is unlikely to be considered harmless, but even if it was, the missing due date prevents a correct match.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate’s due date (2026-07-15) does not match the reference due date (2026-07-10).
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate added an invented due date for "Buy groceries" which was not present in the reference output.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate’s due date (2026-07-15) does not match the reference due date (2026-07-10).
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Due date for 'Call the dentist' does not match reference; expected 2026-07-10T12:00:00-07:00 but got 2026-07-15T12:00:00-07:00.
```

**openai/gpt-4o-mini** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: Candidate added a due date for "Buy groceries" which was not specified in the reference output, violating the requirement for correctly resolved due dates.
```

## Judging

| Spend             | Runs |         Cost |
| ----------------- | ---: | -----------: |
| Models under test |  104 | $0.028214850 |
| Judge             |   98 | $0.008475982 |

Judge verdicts: the judge's reason for every rejected run is quoted under Failures above.

> **Judge overlap.** `openai/gpt-oss-20b` graded `openai/gpt-4o-mini`, which share its model family. A grader tends to prefer output that reads the way it writes, so treat those scores as favouring that family rather than as neutral.

## Reading this report

- `unmeasured` means the harness reported no value for that figure. It does not mean zero, and it does not mean the run failed.
- Cost is what the provider reported for the run, in US dollars.
- `Served by` is the OpenRouter provider that actually answered, resolved per run from the generations it billed. More than one name means routing moved between rounds during that model's runs.
- This report is the evidence, not a recommendation. It does not pick a winner.
