---
name: pr-comments
description: Triage pull request review comments end to end — verify each claim against the code, fix what needs fixing with repo-standard validation, and reply to the rest in-thread. Use when the user asks to handle, analyze, or respond to PR comments or bot reviews (Codex, Copilot) on a pull request.
---

# PR comment triage

Work a PR's review comments to done: every thread ends either with a
fix on the branch or a reply explaining why no fix was needed.

## 1. Collect

Fetch inline threads and top-level reviews. Collapse overlapping bot
comments (Codex and Copilot routinely flag the same issue) into one
distinct issue per underlying claim:

```bash
gh api repos/ponti-studios/hominem/pulls/<N>/comments \
  --jq '.[] | "\(.id) | \(.path):\(.line // .original_line) | \(.user.login)"'
gh pr view <N> --json reviews,comments --jq .
gh pr checks <N>
```

Note which commit each bot reviewed — comments can predate the latest
push, meaning they may already be fixed.

## 2. Verify each claim against evidence

Never trust a review comment at face value. For each distinct issue:

- Read the flagged file and surrounding code.
- Diff against the parent commit (`git show <base>:<path>`) to tell
  introduced-by-this-PR from pre-existing.
- Reproduce failures locally before fixing (e.g. `TZ=UTC pnpm
  --filter @hominem/web test` for timezone-dependent tests).
- Acknowledge valid partial mitigations, but don't let them excuse a
  real regression (e.g. an account-menu link doesn't replace a removed
  back control the repo's navigation rules protect).

## 3. Triage

| Verdict | Action |
| --- | --- |
| Valid, fix is clear-cut | Plan and implement (section 4) |
| Valid, but fix shape is a product call | Ask the user before coding |
| Already fixed by a later push | Reply in-thread citing the commit |
| Invalid or out of scope | Reply in-thread with the counter-evidence |

Surface the per-issue analysis with verdicts before starting work when
more than one issue needs a product call; otherwise proceed and report
at the end.

## 4. Fix

- Check `git status` first. Never commit unrelated dirty files
  (e.g. the user's own uncommitted edits) — stage only the fix.
- Load the `conventional-commit` skill before committing; follow repo
  format/lint/typecheck/test lanes for touched workspaces.
- Validate per the `hominem-evidence` skill: reproduce-then-fix for
  test failures, multi-timezone runs for locale-dependent tests.
- Push to the PR branch so CI re-runs.

## 5. Reply

Reply inside each thread so the discussion stays attached to the code.
Get thread IDs from step 1, then:

```bash
gh api repos/ponti-studios/hominem/pulls/<N>/comments/<THREAD_ID>/replies \
  -f body="<what was done or why not, with commit SHA>"
```

Keep replies to one or two sentences: verdict, commit or
counter-evidence. Verify afterwards that every thread ID has exactly
one human reply:

```bash
gh api repos/ponti-studios/hominem/pulls/<N>/comments \
  --jq '[.[] | select(.user.login == "charlesponti") | .in_reply_to_id] | sort'
```

## 6. Report

Per issue: verdict, fix commit or reply summary, validationEvidence,
and anything still unverified (usually the fresh CI run). Name the PR
URL and any threads deliberately left for the user to decide.
