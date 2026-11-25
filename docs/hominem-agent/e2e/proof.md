# End-to-end proof — Hominem's spine (ROADMAP P7, plans item 1)

Run on the Mac, 2026-11-22, 08:23–08:27 UTC, Node v26.13.1, pi with the
`seme` MCP server connected (14 tools). The `hominem` server was down
(`fetch failed`), which is plans item 2 and not touched here. Audit db:
`~/.hominem/hominem.db`.

**Verdict:** the spine works end to end, but only after three fixes that
this proof itself turned up (P1–P3 below). Memory survives across fresh
sessions. Every external call made through the launcher or a connector
can be read back from `events`, and every launcher invocation is a `runs`
row that now records its end.

This file keeps the failed and pre-fix attempts too, because they are
evidence.

Baseline before the proof: `events` had 2 rows (max id 2) and `runs` had
1 row (max id 1, a P3 smoke run).

---

## Pre-flight — P1: the launcher's `-c` was not a cwd flag

Checked `pi --help` before the first run:

```
  --continue, -c                 Continue the most recent session for the current directory
  --no-session                   Don't save session (ephemeral)
```

The launcher ran `pi --print --no-session -c "$SIERA_HOME" "<prompt>"`. Its
author meant `-c` to set the working directory. In fact `-c` is
`--continue`, so every call:
- resumed the most recent session, which breaks the "fresh session"
  requirement of step 2;
- passed the repo path in as prompt text;
- loaded AGENTS.md only when `hominem` was run from inside the repo.

**Fix:** `cd "$SIERA_HOME"` first, then `pi --print --no-session …`. No
pre-fix run was made. The bug was found by reading `--help`, and the
original launcher was kept for comparison.

---

## Step 1 — `hominem remember` (attempt 1: stored, but the audit was luck)

```
$ cd /tmp && ~/Developer/hominem/hominem remember "Hominem is my name; I am Charles's personal engine replacing Meta Muse; my audit db is ~/.hominem/hominem.db"
```

Output (exit 0, 23.7 s):

```
I saved it in seme as a **fact**: "Hominem is my name; I am Charles's personal engine replacing Meta Muse; my audit db is ~/.hominem/hominem.db". It has **no confidence score**, because `seme_save` doesn't accept one and didn't return one.

- **seme:** the save returned `saved: true` with turn_id `75cce323-…`. I haven't checked it with `seme_recall` yet.
- **Audit:** this is `events` row id 3 in `~/.hominem/hominem.db`: connector `seme-mcp`, command `["seme_save"]`, `ok=true`, took 2977 ms. I re-read the row after writing it.
- **Gap:** `connectors/` has no seme connector, so I wrote the audit row myself by calling `logEvent` in `log/hominem_log.ts`. Also, AGENTS.md names `log/hominem_log.py`, but the file in the repo is the `.ts` one. Both are worth adding to the graduation queue: a `seme-log` connector, and fixing that path in AGENTS.md.
```

Read-back:

```
$ sqlite3 -header ~/.hominem/hominem.db "SELECT * FROM events WHERE id>2; SELECT * FROM runs WHERE id>1;"
3|2026-11-22T08:23:57.433Z|1795335837433|2026-11-22T08:24:00.410Z|1795335840410|2977|seme-mcp|seme|["seme_save"]|{"kind":"fact","content":"Hominem is my name; I am Charles's personal engine replacing Meta Muse; my audit db is ~/.hominem/hominem.db"}||[{"type":"text","text":"{\n  \"saved\": true,\n  \"turn_id\": \"75cce323-e6c7-4c25-a7d5-513477e1561d\"\n}"}]||1|0|||
2|2026-11-22T08:23:43.441Z||brain-remember|invoked|||{"request":"Hominem is my name; ..."}
```

`seme_save` stored the fact verbatim. The `events` row exists only
because the model decided to write one. Nothing in the engine made that
happen. Her flag about the stale `hominem_log.py` path was correct.

## Step 2 — `hominem recall` (attempt 1): read back, but not audited — P2

```
$ cd /tmp && ~/Developer/hominem/hominem recall "What is Hominem"
```

Output (exit 0):

```
I searched seme memory with `seme_recall` for "What is Hominem" and got **one result**:

- **Fact (user_stated, confidence 0.9), observed 2026-11-22T08:23:57Z, still valid:**
  "Hominem is my name; I am Charles's personal engine replacing Meta Muse; my audit db is ~/.hominem/hominem.db"

Nothing else matched. Your profile came back alongside it, but it's about your dating chat voice, not Hominem.

This lookup didn't write an `events` row. I called the seme tool directly, not through a connector in `connectors/` with `log/hominem_log.py`, so `~/.hominem/hominem.db` has no record of it. That breaks the first law in AGENTS.md. A seme connector with logging would fix it.
```

The memory survived into a separate, ephemeral pi process. I checked it
independently from the builder session (outside Hominem) with
`seme_recall({query:"What is Hominem"})`, which returned memory
`622bee4c-f7b4-4921-98cb-6c5ad8c32a25` with the verbatim text,
`user_stated`, confidence 0.9, observed `2026-11-22T08:23:57Z`.

**P2, a law-1 failure:** the db gained no `events` row for this recall,
only `runs` id 3 (`brain-recall`, `invoked`, never closed). The brain's
MCP calls had no logging wrapper at all.

**Fix (`brain/audit_stream.ts`):**
- The launcher now runs `pi --mode json` and pipes the event stream
  through `brain/audit_stream.ts`.
- Every `tool_execution_start/end` pair whose `toolName` matches
  `mcp__<server>__<tool>` becomes exactly one `events` row (connector =
  server, service `mcp`, params, parsed response, ok/is_error, duration).
  This includes calls nested inside codemode.
- The auditor prints her final reply.
- It closes the launcher's `runs` row through the new
  `finishRun(id, …)` in `log/hominem_log.ts`. The launcher overrides the
  status to `failed` if pi itself exits nonzero.

The stream shape was confirmed with a diagnostic
`pi --print --no-session --mode json` probe before writing the code. That
probe ran outside the launcher on purpose, so it has no rows.
`tests/audit_stream.test.ts` covers the fix with a mock stream:
- one row per MCP call;
- non-MCP tools ignored;
- a failing hominem call recorded with `ok=0`;
- noise lines skipped;
- the run closed;
- exit 1 on an empty reply.

Her persona now says these rows belong to the launcher, so she no longer
writes them herself and nothing is double-counted. The stale
`hominem_log.py` references in AGENTS.md and `brain/SIERA.md` now point at
`log/schema.ts` / `log/hominem_log.ts`.

## Step 1 again (attempt 2): audited, but P3 — a duplicate, paraphrased

Output (exit 0):

```
I saved it in seme as a `fact` with confidence 0.9 (source: user_stated). It's memory `1929a303…`: "Hominem is the name of Charles's personal engine; Hominem replaces Meta Muse as his assistant, memory keeper and systems operator. Hominem's audit database is ~/.hominem/hominem.db."

When I read it back, I found the same fact was already stored in your exact words at 08:23Z (`622bee4c…`, also a `fact` at 0.9). There are now two copies. Should I delete the newer one, `1929a303…`, with `seme_forget`? I'm not sure that can be undone.

Audit: the launcher's stream wrapper logs this session's seme calls, one `events` row each, including the `seme_save` and the `seme_recall` used for the read-back.
```

The wrapper wrote the audit rows (ids 4 and 5, and the run is closed;
see the read-back below). Two new failures showed up:
- **Law 3 (idempotency):** a re-run duplicated the memory.
- **Law 2 (verbatim):** she paraphrased Charles's words.

**Fix:** the `remember` prompt now calls `seme_recall` first. When an
equivalent memory already exists it reports it instead of saving, and
when it does save, `content` is exactly the fact text. It never deletes
or corrects.

**Left in place on purpose:** the duplicate `1929a303-5abe-4e0e-b9df-9d240d4040d5`.
Removing it takes `seme_forget`, an irreversible operation, so it waits
for Charles's explicit confirmation (persona law: irreversible operations
are named and confirmed).

## Step 1 again (attempt 3): idempotent

Output (exit 0):

```
That fact is already in seme, so I didn't save it again. Memory `622bee4c-f7b4-4921-98cb-6c5ad8c32a25` matches your wording exactly. It's a `fact` with confidence 0.9, source `user_stated`, observed 2026-11-22T08:23:57Z.

There's also a reworded copy of the same fact: memory `1929a303-5abe-4e0e-b9df-9d240d4040d5`, observed 2026-11-22T08:26:03Z. As you asked, I didn't delete or change either one. The only call was one `seme_recall` (a read), and the launcher's audit wrapper logs it as one `events` row in `~/.hominem/hominem.db`.
```

The only db change was one `seme_recall` row (id 6). No save happened.

## Step 2 again — `hominem recall` in a fresh session, audited

```
$ cd /tmp && ~/Developer/hominem/hominem recall "What is Hominem"
```

Output (exit 0):

```
I searched seme memory with `seme_recall` for "What is Hominem". It returned 2 results:

1. **Observed 2026-11-22 08:26:03Z** (fact, user stated, confidence 0.9): "Hominem is the name of Charles's personal engine; Hominem replaces Meta Muse as his assistant, memory keeper and systems operator. Hominem's audit database is ~/.hominem/hominem.db."
2. **Observed 2026-11-22 08:23:57Z** (fact, user stated, confidence 0.9): "Hominem is my name; I am Charles's personal engine replacing Meta Muse; my audit db is ~/.hominem/hominem.db"

Both memories are still marked valid (neither has an end date). They say the same thing, saved about two minutes apart. They could be merged into one if you want.

The launcher's stream wrapper (`brain/audit_stream.ts`) will log this as one `events` row for the seme recall call. The tool lookup that came before it was local and isn't an external call.
```

The fact saved in step 1 (`622bee4c…`, verbatim) reads back from seme in
a new process, and this time the recall is `events` row 7.

## Step 3 — one audited connector call against a mock backend

Mock backend (`e2e/mock-gws.mjs`, committed so the proof can be re-run):

```js
#!/usr/bin/env node
// Mock Google Workspace CLI: echoes argv and returns a canned Calendar list.
console.log(JSON.stringify({ kind: "calendar#events", mock: true, argv: process.argv.slice(2),
  items: [{ id: "evt1", summary: "Hominem e2e proof", start: { dateTime: "2026-11-22T10:00:00Z" } }] }));
```

```
$ GWS_CLI=/tmp/hominem-e2e/mock-gws.mjs node connectors/gws-log/gws_log.ts calendar events list --params '{"calendarId":"primary","maxResults":1}'
{"kind":"calendar#events","mock":true,"argv":["calendar","events","list","--params","{\"calendarId\":\"primary\",\"maxResults\":1}"],"items":[{"id":"evt1","summary":"Hominem e2e proof","start":{"dateTime":"2026-11-22T10:00:00Z"}}]}
exit=0

$ sqlite3 -header ~/.hominem/hominem.db "SELECT * FROM events WHERE id>7;"
id|ts_request|ts_request_ms|ts_response|ts_response_ms|duration_ms|connector|service|command|params|json_body|response|http_status|ok|is_error|error|exit_code|stderr
8|2026-11-22T08:26:51.321Z|1795336011321|2026-11-22T08:26:51.672Z|1795336011672|350|gws|calendar|["calendar","events","list","--params","{\"calendarId\":\"primary\",\"maxResults\":1}"]|{"calendarId":"primary","maxResults":1}||{"kind":"calendar#events","mock":true,"argv":[...],"items":[{"id":"evt1","summary":"Hominem e2e proof","start":{"dateTime":"2026-11-22T10:00:00Z"}}]}|200|1|0||0|
```

The wrapper passed the output through unchanged. The row shows the
service routed to `calendar`, `--params` parsed into `params`, the
response stored as JSON, `http_status` 200, `ok=1` and `exit_code` 0.

Law 4's negative path:

```
$ env -u GWS_CLI node connectors/gws-log/gws_log.ts calendar events list
gws_log: GWS_CLI is not set — point it at the Google Workspace CLI binary.
exit=2
$ sqlite3 ~/.hominem/hominem.db "SELECT count(*) FROM events WHERE id>8;"
0
```

This is a named error, and no row is written, because no external call
happened.

---

## Final read-back — `events` and `runs` for the whole proof

```
$ sqlite3 -box ~/.hominem/hominem.db "SELECT id, ts_request, connector, service, command, ok, is_error, http_status, exit_code, duration_ms FROM events WHERE id>=3 ORDER BY id;"
│ id │        ts_request        │ connector │ service  │ command                                                                 │ ok │ is_error │ http_status │ exit_code │ duration_ms │
│  3 │ 2026-11-22T08:23:57.433Z │ seme-mcp  │ seme     │ ["seme_save"]                                                           │  1 │        0 │             │           │        2977 │
│  4 │ 2026-11-22T08:26:03.874Z │ seme      │ mcp      │ ["seme_save"]                                                           │  1 │        0 │             │           │         334 │
│  5 │ 2026-11-22T08:26:06.258Z │ seme      │ mcp      │ ["seme_recall"]                                                         │  1 │        0 │             │           │         299 │
│  6 │ 2026-11-22T08:26:29.188Z │ seme      │ mcp      │ ["seme_recall"]                                                         │  1 │        0 │             │           │         223 │
│  7 │ 2026-11-22T08:26:41.844Z │ seme      │ mcp      │ ["seme_recall"]                                                         │  1 │        0 │             │           │          89 │
│  8 │ 2026-11-22T08:26:51.321Z │ gws       │ calendar │ ["calendar","events","list","--params","{\"calendarId\":\"primary\",\"maxResults\":1}"] │  1 │        0 │         200 │         0 │         350 │

$ sqlite3 -box ~/.hominem/hominem.db "SELECT id, ts_start, ts_end, source, status, exit_code, message FROM runs WHERE id>=2 ORDER BY id;"
│ id │         ts_start         │          ts_end          │     source     │  status   │ exit_code │             message              │
│  2 │ 2026-11-22T08:23:43.441Z │                          │ brain-remember │ invoked   │           │                                  │
│  3 │ 2026-11-22T08:24:13.445Z │                          │ brain-recall   │ invoked   │           │                                  │
│  4 │ 2026-11-22T08:25:56.351Z │ 2026-11-22T08:26:10.584Z │ brain-remember │ completed │         0 │ mcp events: 4,5; failed calls: 0 │
│  5 │ 2026-11-22T08:26:22.954Z │ 2026-11-22T08:26:33.112Z │ brain-remember │ completed │         0 │ mcp events: 6; failed calls: 0   │
│  6 │ 2026-11-22T08:26:36.783Z │ 2026-11-22T08:26:45.718Z │ brain-recall   │ completed │         0 │ mcp events: 7; failed calls: 0   │
```

Reading the rows:
- **Event 3** is the model's hand-written row from before the fix. Its
  connector label is `seme-mcp`, different from the wrapper's `seme`.
  It stays as history.
- **Events 4–7** are wrapper-written.
- **Runs 2–3** are the pre-fix invocations. They were opened and never
  closed, which was the other half of P2.
- **Runs 4–6** carry an end time, status, exit code, and the ids of the
  events they caused. A `runs` row now links to its `events`.

## Step 5 — tests and typecheck

```
$ npm test
ℹ tests 33
ℹ pass 33
ℹ fail 0
$ npx tsc --noEmit; echo "typecheck_exit=$?"
typecheck_exit=0
```

That is 30 existing tests plus 3 new ones in `tests/audit_stream.test.ts`.

## What was run, and what was not

- **Run, live:** seme through the brain (save, idempotent re-save, and
  recall in fresh sessions), plus the audit db read-backs.
- **Run, mocked:** the gws connector against `e2e/mock-gws.mjs`, and the
  stream auditor against a recorded-shape event stream.
- **Not run:**
  - hominem: the server is down (plans item 2);
  - a live gws call: no real `GWS_CLI` is configured on this machine;
  - the hatch VM: this proof covers the Mac only.
- **Open for Charles:** whether to `seme_forget` the paraphrased
  duplicate `1929a303-5abe-4e0e-b9df-9d240d4040d5`. It is irreversible,
  so it is not done without his word.
