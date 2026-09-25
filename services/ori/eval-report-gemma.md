# Eval report

Run on 2026-09-19T18:15:53.141Z.

- Evals: career-job-import.eval.ts, chat-assistant.eval.ts, mcp-tool-selection.eval.ts, offer-extraction.eval.ts, task-extraction.eval.ts, time-block-holdout.eval.ts, time-block-regression.eval.ts, voice-cleanup.eval.ts, voice-task-extraction.eval.ts
- Models compared: google/gemma-4-31b-it
- Agent runs: 104
- Tests: 1 passed, 10 failed

## Models

| Model                 | Runs | Failed runs | Correctness   | Served by  | Avg latency |         Cost |
| --------------------- | ---: | ----------: | ------------- | ---------- | ----------: | -----------: |
| google/gemma-4-31b-it |  104 |           0 | 39/104 passed | unmeasured |     9129 ms | $0.040221330 |

Correctness is a ratio over the runs that were graded, not over every run. The failures column answers the other question, whether the model answered at all: a model can answer perfectly and still be marked wrong, and it can fail outright without ever being judged. A run that died before it produced an answer is counted as a failure and left out of correctness entirely, because a rate limit or a rejected credential says nothing about the model's quality; a model whose every run died reads `unmeasured` rather than zero.

## Tests

| Test                                   | Result |  Duration |
| -------------------------------------- | ------ | --------: |
| career job import                      | fail   | 194959 ms |
| chat assistant                         | fail   |  31032 ms |
| MCP tool selection                     | fail   |   8451 ms |
| offer extraction                       | fail   | 390325 ms |
| task extraction                        | pass   |  25076 ms |
| time block holdout                     | fail   | 102212 ms |
| time block regression                  | fail   | 274565 ms |
| voice cleanup                          | fail   |  20722 ms |
| voice task extraction (prompt-v1.json) | fail   |  30196 ms |
| voice task extraction (prompt-v2.json) | fail   |  45369 ms |
| voice task extraction (prompt-v3.json) | fail   |  38830 ms |

## Failures

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.3 is below the minimum 0.7. The judge wrote: The output fails to meet several key criteria: The jobDescription field contains only a summary and omits the full, source‑ordered job description; the experienceLevel, industry, technologyStack, and cultureAspects fields are populated with inferred data that is not present in the source posting (experienceLevel should be empty, industry should be empty, and no tech stack or culture aspects were listed in the source). These violations mean the candidate output does not satisfy the strict grounding and completeness requirements.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The response exceeds the required one or two concise sentences, adds extra advice not present in the reference, and therefore does not meet the criteria.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate omits the key detail that the code now works, which is a material omission. It also provides a suggestion rather than acknowledging the user's success, so it does not meet the reference answer’s criteria.
```

**google/gemma-4-31b-it** was judged failed:

```
expected tool "get_career_portfolio" to be called, but it was not. Tools called: trip_history
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly sets "employmentType" to "employee", whereas the source notes do not specify employment type and the reference output has it as null. This is an invented value and violates the requirement to only include stated facts.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: Missing homeCity field in person object.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, hasBonus, and person.homeCity are null instead of the specified values in the reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, bonusFrequency, hasRelocation, employmentType.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output sets `employmentType` to "employee", whereas the reference output has this field as null. This is an invented value not supported by the source notes, violating the requirement to only include stated facts.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly sets `currencyAmbiguous` to true (there is no contradiction), omits the required `hasEquity` field (should be false), and invents an `employmentType` value of "employee" when the reference specifies null. These deviations violate the criteria for accurate, complete extraction.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly sets equityValue to 25000 instead of the required 100000 and incorrectly specifies employmentType as "employee" when the reference has it null. These deviations violate the requirement to match all stated compensation, equity, and employment facts exactly.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity should be false, employmentType should be null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.9 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: The candidate output incorrectly sets "employmentType" to "employee" even though the source notes do not specify employment type. All other fields match the reference output.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: Missing equityValue for Offer B; candidate set it to null instead of 50000.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing or incorrect values: equityValue should be 50000 but is null; bonusFrequency should be "annual" but is null; employmentType should be null but is "employee". These omissions/inventions violate the requirement to include every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, hasRelocation, employmentType incorrectly set; candidate output does not match reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate omitted required fields for equity and relocation. The reference specifies hasEquity:false and hasRelocation:false, but the candidate set these to null, violating the requirement to include every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate omitted required fields and provided incorrect values: hasRelocation is null instead of false, and employmentType is set to "employee" instead of null as in the reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes an employmentType value 'employee' which was not present in the source notes or reference output; this is an invented value and violates the requirement to only include stated facts.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, hasRelocation, employmentType. Incorrect nulls and invented values.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.25 is below the minimum 0.7. The judge wrote: Equity type and employment type differ from reference; employment type was invented.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.2 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, bonusFrequency, hasRelocation, employmentType.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields and incorrect values: hasEquity, hasBonus, employmentType.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output does not match the reference: location is reported as "london-ontario" instead of the canonical "london"; bonusFrequency is omitted (should be "annual"); hasRelocation is null instead of false. These omissions and mismatches violate the requirement to include every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required field equityValue (should be 100000).
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate omitted the required baseSalary value (312000) from the offer, violating the requirement to include every stated compensation detail.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate omitted required fields and set several boolean fields to null instead of false, violating the requirement to include every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Missing required fields: hasEquity, bonusFrequency, employmentType; hasEquity incorrectly null instead of false; bonusFrequency null instead of 'annual'; employmentType set to 'employee' though reference null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate omitted required fields: equityValue, bonusFrequency, and hasRelocation. These fields are present in the reference and must be included; null values are only allowed when information is truly missing, not when it is provided in the reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate omitted several required fields that are present in the reference output (e.g., baseSalary, hasRelocation, requiresVisa, employerCoversVisa).
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output omits required fields and provides incorrect values: hasEquity is null instead of false, hasRelocation is null instead of false, and employmentType is set to "employee" while the reference expects null. These omissions and inaccuracies violate the requirement to include every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.2 is below the minimum 0.7. The judge wrote: Location string mismatch ("cape-town" vs "cape town"), missing bonusFrequency (should be "annual"), hasRelocation incorrectly null (should be false), and employmentType incorrectly set to "employee" (should be null).
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output does not match the reference: currency is null instead of USD, equityValue is null instead of 50000, and employmentType is "employee" instead of null. These omissions and incorrect values violate the requirement to include every stated fact.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate invented scheduling_window_start and scheduling_window_end, which were not specified in the request or reference output.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate’s start_time and end_time use the wrong UTC offset (-07:00) for 2026-11-01 in America/Los_Angeles, where daylight saving ends on that date, so the temporal grounding is incorrect. All other fields match the reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Scheduling window start/end differ from reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes scheduling_window_start and scheduling_window_end values, which are not present in the reference output and are not explicitly requested by the user. According to the criteria, fields not established by the request must be null, and inventions or superseded values should be penalized.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate invented scheduling_window_start and scheduling_window_end which were not specified in the request or reference. This violates the requirement to keep null for unspecified fields.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate invented scheduling_window_start and scheduling_window_end values that are not present in the reference; those fields should be null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes scheduling_window_start and scheduling_window_end values that were not present in the reference output and are not explicitly requested by the user. According to the criteria, fields not established by the request must be null, and invented values are penalized. Therefore the candidate output does not meet the required criteria.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate invented scheduling_window_start and scheduling_window_end, which are not established by the request.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate incorrectly sets the event date to 2026-07-31 (Wednesday) instead of the correct Friday (2026-07-26) as specified in the user request. This violates the temporal grounding requirement.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly provides a duration of 60 minutes, whereas the request did not specify a duration and the reference output has duration set to null. This invention violates the requirement that fields not established by the request must remain null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate added scheduling_window_start and scheduling_window_end, which were not specified in the request; these fields should remain null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.75 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: Candidate invented a duration and incorrectly set the start and end times; all other fields match the reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes non‑null values for scheduling_window_start and scheduling_window_end, which were not specified in the request and are not present in the reference output. This constitutes an invention of fields that should remain null, causing the output to fail the evaluation criteria.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes scheduling_window_start and scheduling_window_end values, whereas reference expects null for these fields. This is an invention not supported by the request and deviates from the expected output.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly sets a duration of 60 minutes, whereas the user did not specify a duration. All other fields match the reference, but the invented duration violates the requirement to leave unspecified fields null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output incorrectly sets title, target_title, and duration fields; these should be null as not specified by request.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed. Its score 0.8 is at or above the minimum 0.7, so the minimum is not what rejected this run. A passing score under a failing verdict usually means the rubric and the score are measuring different things. The judge wrote: The candidate output incorrectly provides a duration of 60 minutes, whereas the request did not specify a duration. All other fields match the reference output.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output has an incorrect primary_intent ('add_event' instead of 'add_task') and invents a scheduling window that was not specified in the request, violating the requirement to leave unspecified fields null. The title difference is harmless, but the intent and temporal grounding errors cause the evaluation to fail.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes a non‑null title field, which was not specified in the user request. According to the criteria, fields not established by the request must be null, so this is an invention and disqualifies the output.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output incorrectly sets target_title to "meeting Sunday at 10 AM" instead of the reference value "I can't make the 10 AM meeting—find another time", and invents a duration of 60 minutes where the reference has null. Both differences violate the criteria and are not harmless title wording differences.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output includes non‑null values for scheduling_window_start and scheduling_window_end, which were not specified in the reference output or the user request. According to the criteria, any fields not established by the request must remain null, and invented values are penalized.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Candidate output includes invented scheduling_window_start and scheduling_window_end fields, which are not established by the request. All other fields match the reference or are correctly null.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: The candidate added the phrase "I think it's" which is not present in the reference, altering the content beyond harmless punctuation or capitalization changes. The added "also" is filler but the extra phrase changes the exact cleaned text, so it does not fully meet the criteria.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: Priority and due date mismatches.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate’s due date (2026-07-17T12:00:00-07:00) does not match the reference due date (2026-07-10T12:00:00-07:00).
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate output does not match the reference: it uses non‑standard priority labels ('ASAP', 'no rush') instead of the expected 'high' and 'low', and it invents due dates for tasks that had none in the reference. This violates the requirement for correct urgency and due dates.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate sets the due date to 2026-07-17, which does not match the reference due date of 2026-07-10 and therefore fails the requirement.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.3 is below the minimum 0.7. The judge wrote: The second task’s due date differs from the reference (2026-07-10T12:00:00-07:00 vs. 2026-07-17T12:00:00-07:00).
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0.5 is below the minimum 0.7. The judge wrote: The candidate added a due date for "Buy groceries" that is not present in the reference output. All other tasks and priorities match, but the invented due date causes a mismatch with the reference.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate’s due date (2026-07-17) does not match the reference due date (2026-07-10).
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The second task’s due date is incorrect; it should be 2026-07-10T12:00:00-07:00, not 2026-07-17T12:00:00-07:00.
```

**google/gemma-4-31b-it** was judged failed:

```
judge rejected the candidate: the judge marked it failed, and its score 0 is below the minimum 0.7. The judge wrote: The candidate added a due date for "Buy groceries" that was not present in the reference output. This constitutes an invented date, violating the requirement to match the reference semantically and not introduce new information.
```

## Judging

| Spend             | Runs |         Cost |
| ----------------- | ---: | -----------: |
| Models under test |  104 | $0.040221330 |
| Judge             |   98 | $0.008499884 |

Judge verdicts: the judge's reason for every rejected run is quoted under Failures above.

## Reading this report

- `unmeasured` means the harness reported no value for that figure. It does not mean zero, and it does not mean the run failed.
- Cost is what the provider reported for the run, in US dollars.
- `Served by` is the OpenRouter provider that actually answered, resolved per run from the generations it billed. More than one name means routing moved between rounds during that model's runs.
- This report is the evidence, not a recommendation. It does not pick a winner.
