---
title: 'Top-up browser verification for uncovered web chat journeys'
status: 'Proposed'
priority: 'high'
labels: [web, chat, browser]
depends_on: [web-chat-reinventory-matrix.md]
blocks: []
estimated_size: 'S'
---

## Outcome

Journeys without playbook coverage (per the re-inventory matrix diff) are
verified in a real browser, with a screenshots/DOM/console manifest keyed by
journey. Journeys the playbook already covers get no new runs.

## Scope

In scope: Playwright verification for uncovered journeys only, per the
corrected matrix in `web-chat-reinventory-matrix.md`. Sibling tasks:
`web-chat-focused-coverage.md` and `web-chat-a11y-topup.md` (parallel),
`web-chat-gap-reconciliation.md` (consumes all three).

Out of scope: journeys already covered below, accessibility/layout passes
(sibling a11y task), implementing missing behavior (new reconciliation
tasks).

Composer attachment/voice parity (`composer-parity.md`) is complete and its
task spec removed; browser verification for those flows should build on the
decisions and focused unit/component tests recorded in
[chat.composer-audio-modality.md](../decisions/chat.composer-audio-modality.md)
and [chat.composer-error-recovery.md](../decisions/chat.composer-error-recovery.md),
not re-derive them.

## Already covered — do not re-run

Per the 2026-09-15 baseline in `apps/web/tests/e2e/chat-playbook.spec.ts`:
send and new-chat entry (`SEND-01..04`), regenerate (`SEND-05`), tool calls
and approval (`TOOL-01..04`), failure/retry/recovery (`RECOVER-01..06`),
launch and missing/unowned-chat recovery (`LAUNCH-01..04`, `UI-01`/`UI-02`),
edit/delete (`UI-03`), copy/share/listen/regenerate controls (`UI-04`).

## Acceptance criteria

- [ ] AC-001: Every journey the matrix marks uncovered has a browser run with artifacts.
- [ ] AC-002: The manifest maps each journey to its screenshots, DOM snapshot, and console output.
- [ ] AC-003: No missing journey is represented as verified without artifacts.

## Exit gate

Close when the manifest and artifacts are reviewed. Product fixes discovered
here do not get silently added to this task.
