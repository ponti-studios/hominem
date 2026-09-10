# Functional Chat Browser Playbook

This playbook defines repeatable browser evidence for the functional chat
release gate. It tests the running Web application against the running API and
real persistence. Provider permutations and deterministic dependency failure
injection belong in focused Vitest/MSW or API-local `HominemTests` tests.
Browser runs prove that real responses become correct user-visible state and
survive lifecycle transitions where browser or device behavior is part of the
contract.

## Preconditions

- Web and API services are running at the documented local URLs.
- The browser is authenticated as a disposable test user or an explicitly
  authorized development user.
- The target chat is owned by that user and contains no irreplaceable data.
- Browser console logs and the API log stream are available for correlation.
- Record the git revision, browser viewport, API/Web URLs, chat ID, user/test
  label, and timestamp before starting.

Never use a production conversation for destructive or failure-path testing.
Create a disposable chat and record its ID instead.

## Evidence record

For each scenario, record:

| Field | Required value |
| --- | --- |
| Scenario | Stable scenario name below |
| Boundary | Web ↔ API, plus route if known |
| Environment | Revision, URLs, viewport, browser, user/chat label |
| Action | Exact user action and timing |
| Observed state | Visible messages, tool state, loading/error state, controls |
| Recovery state | Cursor/reconnect/reload result and duplicate check |
| Correlation | Generation ID, durable sequence, request ID when visible in logs |
| Artifacts | Screenshot, DOM snapshot, console/API log excerpt, or video |
| Result | `Implemented`, `Partial`, `Open`, or `Blocked` |
| Unverified | Any assertion that could not be observed |

Use one artifact per meaningful state transition, not a screenshot dump. Never
record provider arguments, credentials, or sensitive message content in logs.

## Standard run protocol

1. Open the disposable chat by direct URL.
2. Confirm the initial state: chat title, existing message count, composer,
   and absence of unexpected console errors.
3. Perform exactly one scenario action.
4. Capture visible state after each transition: preparing, streaming,
   tool/confirmation, terminal, and recovery.
5. Cross-check API logs for the generation ID and durable sequence order.
6. Reload or reconnect only where the scenario requires it.
7. Verify semantic state, not timing or presentation details: messages, tool
   lifecycle, terminal outcome, and absence of duplicates.
8. Record the evidence row before moving to the next scenario.
9. Delete the disposable chat only after all artifacts are collected.

## Scenario IDs and control markers

This playbook uses two separate, non-overlapping vocabularies. Never
reintroduce a single shared numbering for both — that conflation is exactly
what the old flat `B-nnn` scheme did, and it caused real collisions (the same
number meaning different things in different files).

- **Scenario IDs** (`<CATEGORY>-<NN>`, e.g. `SEND-02`, `RECOVER-06`) identify
  a row in the matrix below, a Playwright test title, and an evidence-record
  entry. They are grouped by concern so a new scenario slots into its own
  family without renumbering or colliding with an unrelated one. They are
  never sent as chat message content and are never pattern-matched by any
  code.
- **Control markers** (`SCRIPT:<VERB>`, e.g. `SCRIPT:STREAM`,
  `SCRIPT:CANCEL_BEFORE`) are literal substrings embedded in chat message
  text that `services/api/src/testkit/scripted-providers.ts` pattern-matches
  to steer deterministic mock behavior (forced tool calls, forced failures,
  streaming timing). Only scenarios that need specific mock timing/behavior
  use one; most scenarios need no marker at all, just plain descriptive
  message text. A scenario ID is never derived from, or required to match,
  the control marker(s) it happens to use.

## Scenario matrix

### Core send and navigation

| ID | Action | Observable evidence |
| --- | --- | --- |
| SEND-01 | Open a completed disposable chat directly | History loads; messages and tool cards match persisted state; no console error |
| SEND-02 | Send a normal message | User message appears once; streamed assistant response completes; one terminal outcome; refresh preserves it |
| SEND-03 | Start a chat from the new-chat entry point | New URL/chat identity; first message and response persist; chat list contains the new chat |
| SEND-04 | Navigate chat list → chat → back → chat | Correct chat loads each time; no stale conversation or cross-chat messages |
| SEND-05 | Regenerate the latest assistant response | New generation is visible; prior history remains; final response is not duplicated |

### Tools and confirmation

| ID | Action | Observable evidence |
| --- | --- | --- |
| TOOL-01 | Trigger a successful tool call | Tool card transitions pending → completed; assistant continuation renders |
| TOOL-02 | Trigger confirmation-required tool and approve | Confirmation is visible; approval resumes the same semantic flow; result and terminal state persist |
| TOOL-03 | Trigger confirmation-required tool and reject | Rejection is visible; no execution-success state appears; documented continuation/terminal rule is followed |
| TOOL-04 | Trigger a tool failure | Failed tool state is visible; no fabricated successful result; recovery control behaves correctly |

### Failure, cancellation, and transport recovery

These scenarios require a scripted provider or failure-injection mode exposed by
the test environment. The browser must not depend on arbitrary production
provider behavior.

| ID | Action | Observable evidence |
| --- | --- | --- |
| RECOVER-01 | Provider failure then retry | Safe error appears; durable failed state survives reload; retry creates a new attempt without rewriting history |
| RECOVER-02 | Cancel before execution | Cancel wins before provider/tool execution; durable terminal state is authoritative |
| RECOVER-03 | Cancel while streaming or persisting | UI stops cleanly; no false success; first durable terminal decision wins |
| RECOVER-04 | Disconnect during text/tool/confirmation/finalization | Transport ends without fabricated terminal state; reconnect recovers from durable history |
| RECOVER-05 | Reconnect with overlapping replay | Existing events are not applied twice; messages/tool cards remain single and ordered |
| RECOVER-06 | Reload during awaiting confirmation | Confirmation remains actionable and owned by the same generation |

### Fresh launch and authorization

| ID | Action | Observable evidence |
| --- | --- | --- |
| LAUNCH-01 | Close/reopen the browser on a completed chat | Fresh reducer reconstruction equals the pre-close semantic state |
| LAUNCH-02 | Reload during an active generation | Replay/live handoff completes without lost or duplicate durable events |
| LAUNCH-03 | Open an unowned chat URL | Safe authorization failure; no private messages, tools, or event data are rendered |
| LAUNCH-04 | Attempt unowned send, regenerate, cancel, replay, delete, and confirmation | Every operation is denied consistently; no durable state changes |

### Message and presentation behavior

| ID | Action | Observable evidence |
| --- | --- | --- |
| UI-01 | Load a slow or empty chat | Vitest/MSW proves loading/empty transitions; optional browser smoke confirms presentation |
| UI-02 | Force a load/generation error | Vitest/MSW proves error mapping and recovery; optional browser smoke confirms presentation |
| UI-03 | Edit and delete a user message | Edit persists; delete confirmation is visible; deletion updates the conversation and chat list |
| UI-04 | Use copy, share, listen, and regenerate actions | Each action has correct enabled/loading/error state and does not alter unrelated messages |
| UI-05 | Resize to the smallest supported viewport | Composer, tool cards, confirmation, error, and long messages remain usable |
| UI-06 | Use keyboard and assistive labels | Submit/cancel/confirmation/retry/delete controls are keyboard reachable and named |
| UI-07 | Preserve an unsent composer draft across reload | Only the draft persists across reload; no unsent draft is ever sent |
| UI-08 | Send and read a message under `prefers-reduced-motion` | No console errors; message sends and reads normally with motion reduced |
| UI-09 | Keep the composer interactive immediately after send | Composer accepts input before the reply arrives; nothing blocks on generation latency |

## Scenario completion rules

A browser scenario is `Implemented` only when the visible assertion, the
corresponding API/durable assertion, and the required artifact are all present.
If the API result is correct but browser state is unverified, mark it
`Partial`. If the environment cannot produce the required state, mark it
`Blocked` and record the exact dependency. Do not infer browser proof from a
unit test or SDK test.

For UI-01 and UI-02, the authoritative behavioral result is focused
Vitest/MSW evidence because the failure is induced at the Web client or SSR
dependency boundary. A browser smoke artifact is supplementary and is not a
reason to build server-side request interception into Playwright.

Run SEND-01 through SEND-05 first, then TOOL-01 through TOOL-04, then
RECOVER-01 through RECOVER-06 and LAUNCH-01 through LAUNCH-04, and finally
UI-01 through UI-09. A later scenario may be run only after the preceding
scenario has a recorded result, even when the later scenario is easier.
