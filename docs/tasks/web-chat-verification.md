---
title: 'Verify web chat parity and accessibility states'
status: 'Proposed'
priority: 'high'
labels: [web, chat, browser, accessibility]
depends_on: [motion-and-persistence.md]
blocks: []
estimated_size: 'L'
---

## Outcome

The completed Web chat parity work is verified across critical interaction,
loading, recovery, mutation, accessibility, and responsive states.

## Scope

In scope: route, hook, component, Playwright, keyboard, screen-reader, and
responsive verification for capabilities documented in chat.capabilities.md.
Out of scope: implementing missing product behavior discovered during
verification; those become separate tasks.

Composer attachment/voice parity (`composer-parity.md`) is complete and its
task spec removed; W-003's browser verification for those flows should build
on the decisions and focused unit/component tests recorded in
[chat.composer-audio-modality.md](../decisions/chat.composer-audio-modality.md)
and [chat.composer-error-recovery.md](../decisions/chat.composer-error-recovery.md),
not re-derive them.

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Build capability matrix | Web docs/tests | Tasks 21–22 | matrix artifact | Each claimed capability maps to a test and evidence type. |
| W-002 | Add focused coverage | Web routes/hooks/components | W-001 | Web test output | Critical actions and error/recovery states have focused tests. |
| W-003 | Run browser verification | Playwright | W-002 | screenshots/DOM/console manifest | Send, cancel, failure, retry, regenerate, actions, tools, navigation, and missing-chat recovery are verified. |
| W-004 | Verify accessibility/layout | Web browser | W-003 | keyboard/accessibility/viewport artifacts | Names, focus recovery, keyboard behavior, and smallest supported layout pass. |
| W-005 | Reconcile gaps | task/capability matrix | W-003, W-004 | gap list | Every gap is fixed in a new task or explicitly marked unavailable. |

## Acceptance criteria

- [ ] AC-001: Every marked-present capability has focused automated coverage.
- [ ] AC-002: Critical journeys have browser artifacts.
- [ ] AC-003: Keyboard, accessible names, focus recovery, and responsive layout are verified.
- [ ] AC-004: No missing capability is represented as present without evidence.

## Exit gate

Close only when the matrix, focused tests, browser artifacts, and gap list are
reviewed. Product fixes discovered here do not get silently added to this task.
