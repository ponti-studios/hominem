---
title: 'Reconcile remaining web chat gaps'
status: 'Proposed'
priority: 'high'
labels: [web, chat]
depends_on: [web-chat-focused-coverage.md, web-chat-browser-topup.md, web-chat-a11y-topup.md]
blocks: []
estimated_size: 'S'
---

## Outcome

Every remaining gap from the corrected matrix is either fixed in a new
implementation task or explicitly marked unavailable with a reason. No gap
is left unowned.

## Scope

In scope: triaging the gap list produced from the corrected matrix in
`web-chat-reinventory-matrix.md` plus the three top-up tasks
(`web-chat-focused-coverage.md`, `web-chat-browser-topup.md`,
`web-chat-a11y-topup.md`): file a new task per gap needing implementation,
or record it as unavailable.

Out of scope: implementing the gaps themselves — each fix is its own task
with its own owner and validation.

## Acceptance criteria

- [ ] AC-001: The gap list is complete against the corrected matrix and top-up artifacts.
- [ ] AC-002: Every gap has an owning implementation task or an unavailable marker with reason.
- [ ] AC-003: No missing capability is represented as present anywhere in web docs or UI copy.

## Exit gate

Close when the gap list and its task links/markers are reviewed.
