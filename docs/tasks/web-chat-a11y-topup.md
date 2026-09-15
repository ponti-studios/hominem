---
title: 'Top-up web chat accessibility and layout verification'
status: 'Proposed'
priority: 'high'
labels: [web, chat, accessibility]
depends_on: [web-chat-reinventory-matrix.md]
blocks: []
estimated_size: 'S'
---

## Outcome

Accessibility and responsive-layout rows without existing coverage pass
with keyboard/accessibility/viewport artifacts. Rows the playbook already
covers get no new runs.

## Scope

In scope: keyboard behavior, accessible names, focus recovery, and
responsive layout for rows the re-inventory matrix marks uncovered, per
`web-chat-reinventory-matrix.md`. Sibling tasks:
`web-chat-focused-coverage.md` and `web-chat-browser-topup.md` (parallel),
`web-chat-gap-reconciliation.md` (consumes all three).

Out of scope: rows already covered below, general browser journey
verification (sibling browser task), implementing missing behavior (new
reconciliation tasks).

## Already covered — do not re-run

Per the 2026-09-15 baseline in `apps/web/tests/e2e/chat-playbook.spec.ts`:
smallest supported viewport (`UI-05`), keyboard-reachable named controls
(`UI-06`), reduced-motion operation (`UI-08`).

## Acceptance criteria

- [ ] AC-001: Uncovered rows have verified accessible names and keyboard behavior.
- [ ] AC-002: Focus recovery after dialog, error, and navigation states is verified.
- [ ] AC-003: The smallest supported layout passes for uncovered views.
- [ ] AC-004: Artifacts (keyboard runs, a11y tree snapshots, viewport captures) exist per row.

## Exit gate

Close when the artifacts are reviewed. Product fixes discovered here do not
get silently added to this task.
