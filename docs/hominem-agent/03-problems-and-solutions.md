# Problems faced and solutions implemented

Every problem hit while building Hominem, with the fix that landed. This is
the engine's own feedback surface — the same discipline her laws demand of
her (verify before asserting, name the missing variable, learn from the
audit trail) applied to building her.

## Orchestration (Rex pane fan-outs)

**Provider 429 rate limits killed three of four LLM workers.** Fan-out
workers share the manager's provider quota; four parallel workers plus the
manager tripped the limit repeatedly (the youtube-music worker died twice).
*Solution*: the manager ported the dead workers' connectors directly.
*Lesson*: price the batch and stagger LLM fan-outs; deterministic work
(script ports) does not need an LLM per pane at all.

**`rex send` types text without pressing Enter.** Commands sat unexecuted at
pane prompts while polls reported silence. *Solution*: pipe text with a
trailing newline (`printf 'cmd\n' | rex send`) or follow with
`rex send-key … Enter`.

**Rex panes vanish when their command exits.** The first grid attached
commands at `split` time; finished workers' panes disappeared, so splits
from them failed and block listings shrank. *Solution*: build grids from
persistent *shell* panes and send commands in afterwards.

**Session label collisions.** Two sessions shared the label
`kernel-testplan-audit`; a lookup by label matched both and corrupted
later commands. *Solution*: select by creation order, rename dead sessions.

**macOS bash 3.2 quirks.** No `mapfile`; `${var%%:*}` splits at the *first*
colon, destroying Rex IDs (`block:01a2...`) packed into `id:name` strings.
*Solution*: while-read loops; `${var%:*}` / `${var##*:}`.

## Environment drift

**Rex panes resolve `python3` to Xcode's 3.9; the dev shell uses mise
3.13.** Worker crashes (`sys.stdlib_module_names` missing) and 31 spurious
`--help` failures all traced to interpreter drift, verified by re-running
under the dev interpreter. *Solutions*: version-tolerant code
(`getattr(sys, "stdlib_module_names", ())`), and — decisively — the move
to TypeScript with Node 26, one runtime across brain and tests. *Lesson*:
fan-out workers must pin their interpreter, and `--check` output must name
it.

**Dotted tokens crash `importlib.util.find_spec`.** A prereq token like
`foo.auth` makes find_spec import the parent, raising instead of returning
None. *Solution*: wrap in try/except and treat as missing.

## Porting

**The notion worker wrote to `connectors/custom.notion-log/`** — it
faithfully followed the prompt, which passed the archive's directory name
as the target. *Solution*: moved the directory, fixed the test's path
reference, kept the worker's code.

**Path-vs-basename matching produced false "stale" refs.** The kernel
test-plan audit flagged `scripts/contrast.py` as missing while it lived at
`references/kernel-design/scripts/contrast.py`. *Solution*: basename-match
instead of comparing full path tokens.

**Faithfulness beats tidiness — three times.** (1) Linear's in-band error
payloads keep `ok=true`; a "fix" that flipped ok broke the test until the
original semantics were restored. (2) Linear leaves `is_error` NULL on
nonzero exit — the error lives in the error column; the assertion, not the
port, was wrong. (3) Notion's envelope `isError: false` stays false on an
in-band payload error for the same reason. *Lesson*: when porting tested
behavior, the tests are the spec.

**Layer 1 test fixtures — three bugs the verification run caught.** (1)
Object keys with dots written unquoted (`hominem_sync_state.json:` …) —
tsx strips types without parsing, so Node failed with a bare
`ERR_INVALID_TYPESCRIPT_SYNTAX` and only `tsc --noEmit` named the lines;
now every `.json`-named key is quoted. (2) The `env()` helper eagerly wrote
the default wealth dir on every call, so a test's custom
`HOMINEM_AGENT_WEALTH_DIR` (stale watermarks) was overwritten before the child ran
— fixed by writing the default only when the caller didn't pass one.
(3) An age assertion said "22 days" for Oct 1 → Nov 22, which is 52 —
the fixture date moved to match the claim. *Lesson*: build the fixture
and the assertion from the same arithmetic, and let the failing run
name which of the two lied.

**Layer 2 port-fidelity catches — the envelope is the contract.** (1)
The port had folded the archived bill-flag keys (`bill`, `provider`,
`previous_amount`, `due_date`/`last_paid_on`) into the anomaly flags'
`merchant` shape; re-reading the archived `diff_bills` before shipping
re-aligned them verbatim — the brief's consumers read those names.
(2) The quiet-day fixture put an unrepeated −100 transfer in
yesterday's rows: the archived anomaly rules filter on `excluded` only,
and the sync writes transfers as `excluded: false`, so a first-time big
Space move legitimately flags `first_seen_merchant` — the fixture
became a recurring Space move with history rather than "fixing" the
faithful port. (3) A `??=` on a `Map.get()` result is not an
assignable target (TS2364) — bucket upserts need get-check-set.
*Lesson*: when a test won't go quiet, check whether the port or the
fixture is the one telling the truth about the archived semantics
before touching either.

**Layer 3 port catches — the gate did its job twice.** (1)
`listFinanceAccounts()` returns the wrapper envelope, not the array;
the port passed the envelope straight into the balance loop, and
every mocked test failed exit 1 before a single assertion ran —
tsc's TS2345 named the exact lines first. *Lesson*:
a mocked-first gate turns a wrong shape into a loud failure, not a
silent miscount. (2) The "provably empty timeline" fixture still
carried the payroll row, so the salary projection would have quietly
polluted the assertion — the fixture was rebuilt from the claim, not
the port weakened (same lesson as Layer 2, one layer later). (3) The
`events.ok` column reads back from sqlite as `0`/`1`, not
`true`/`false` — assert the integer the read-back actually returns.
(4) A targeted `types.ts` edit briefly replaced the live
`isoDaysBetween` helper instead of appending beside it — caught by
grepping its callers before the gate. *Lesson*: in shared type
modules, additive edits must be additive — grep the old symbol's
callers after any edit that was meant to append.

## TypeScript conversion

**better-sqlite3's native build blocked by npm's install-scripts gate.**
*Solution*: `npm install-scripts approve better-sqlite3` + rebuild; the
addon builds clean on Node 26. (Considered `node:sqlite` first — it works
without deps — but drizzle's driver set required better-sqlite3.)

**drizzle's optional-peer type noise.** `gel`, `mysql2` type errors from
drizzle's own `.d.ts` files. *Solution*: `skipLibCheck: true`.

**`$client` vs a custom `$sqlite` handle.** Attaching a property to
drizzle's returned db failed type conversion. *Solution*: drizzle already
exposes the better-sqlite3 handle as `db.$client` — typed via an
intersection, no casting games.

**Legacy database compat for the migration ledger.** The live db
predates the `hominem_migrations` ledger; a naive applier would have failed
or rewritten it. *Solution*: if the ledger is empty and the `events`
table already exists, the first migration is recorded as applied without
executing. *Evidence*: the Python-era row 1 reads back through drizzle.

**spawnSync deadlocks in-process mock servers.** The ytm wrapper hung
against its mock: the test process hosting the mock HTTP server called
`spawnSync`, blocking its own event loop — the child's fetch waited on a
server that could never answer. The wrapper itself was innocent (async
spawn worked). *Solution*: `runWrapper` is async spawn with a timeout.
*Lesson recorded in the code comment*: never spawnSync against an
in-process server.

**Bash `$?` expansion mangled a nullish coalescer.** Inside the
launcher's double-quoted `node -e` script, `??` became `0?` — bash
expanded `$?` (last exit status) mid-expression, producing a syntax error.
*Solution*: `(process.argv[2] || '')`. *Lesson*: never put `$`-sensitive
JS (`??`, `${}` template literals) inside double-quoted inline node
scripts.

**A missing closing brace survived two rounds of "fixing the wrong
thing."** The launcher's audit call kept failing; the first two attempted
causes (env expansion, then the `??`) were real but not the whole story —
the object literal was missing its final `}`. *Solution*: read the syntax
error's position precisely and count the braces. *Lesson*: one error can
have two independent causes; verify each fix by running, not by pattern
matching.

## End-to-end proof (`e2e/proof.md`)

**pi's `-c` is `--continue`, not a working-directory flag.** The
launcher passed `-c "$HOMINEM_AGENT_HOME"`. That resumed the most recent session
(breaking "fresh session"), fed the repo path in as prompt text, and
loaded AGENTS.md only when run from inside the repo. *Solution*:
`cd "$HOMINEM_AGENT_HOME"`, then `pi --print --no-session`. *Lesson*: check a
flag against `--help` before trusting what it seems to mean. It was
caught in pre-flight, before any proof run.

**The brain's MCP calls had no logging wrapper (law 1).** `remember`
produced an `events` row only because the model chose to write one, and
`recall` produced none. *Solution*: the launcher runs `pi --mode json`
and pipes the stream through `brain/audit_stream.ts`. Each
`mcp__<server>__<tool>` execution becomes one `events` row, including
calls nested inside codemode. The launcher's `runs` row is closed through
the new `finishRun`, and the persona now leaves those rows to the
launcher. *Lesson*: an audit that depends on the model's judgment is not
an audit. Put the wrapper below the model.

**`runs` rows were opened and never closed.** The launcher `exec`ed pi
after writing an `invoked` row, so nothing recorded the outcome.
*Solution*: no `exec`. The stream auditor stamps `ts_end`, status, exit
code and the event ids it wrote, and pi's own nonzero exit overrides the
status to `failed`.

**`remember` was neither idempotent nor verbatim (laws 2 and 3).**
Re-running it saved a second, paraphrased copy of the fact. *Solution*:
the prompt calls `seme_recall` before `seme_save`, reports an existing
match instead of saving, and saves `content` exactly as given. The
third run made zero saves. The duplicate it left
(`1929a303-5abe-4e0e-b9df-9d240d4040d5`) waits for Charles: removing it
takes `seme_forget`, which is irreversible.

## Kernel-side items that fed this build

**python-pptx missing with no skill-owned install path** (from the Rex
fan-out test-plan audit) — became the powerpoint skill's
`scripts/setup.py --check/--install-deps` so dependencies install through
the skill, once, into the interpreter that runs it. The same principle
became Hominem law 4 (env config, named errors).

**WAL assertions must follow schema creation.** A test opening a fresh
sqlite connection to a not-yet-created db saw default journal mode.
*Solution*: let the writer create the db first, then assert.
