# Milestone Plan

## Goal

4.2 — Shared composer parity

## Approach

Build the shared composer host and route targeting first, then layer note mentions, draft restore, and submit semantics on top of that stable host. This keeps the highest-coupling behavior explicit and reviewable.

## Work Item Breakdown

| Work Item                                           | Purpose                                                                        | Depends On                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| shared-composer-route-targeting-and-selection-chips | Shared composer host, targeting, visibility rules, and selection-chip behavior | none                                                |
| note-mentions-draft-restore-and-submit-actions      | Note mentions, draft restore, and submit action parity                         | shared-composer-route-targeting-and-selection-chips |

## Critical Path

`shared-composer-route-targeting-and-selection-chips` is the bottleneck because draft, mention, and submit behavior all depend on a stable shared host model.

## Sequencing Rationale

The host and targeting behavior land first because they define where and when the composer exists. Drafts, mentions, and submit behavior follow only after the shared host is stable across routes.

## Deliverables

- Native shared composer host across inbox, notes, and chat
- Route targeting, visibility rules, and selection-chip parity
- Draft restore, mentions, and submit action parity

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] The shared composer behaves consistently across supported routes on device
- [ ] Draft restore and submit behavior are stable enough for attachment work to begin

## Risks

| Risk                                                              | Likelihood | Impact | Mitigation                                                             |
| ----------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Route targeting and composer visibility drift under state changes | Med        | High   | Verify route transitions and restore cases directly during review      |
| Draft restore makes hidden assumptions about local state          | Med        | High   | Keep restore rules explicit and test them independently of attachments |

## Open Questions

- Which route-visibility rules are truly required for parity versus acceptable follow-up polish? Owner: mobile team. Deadline: before host work exits.
- What exact draft restore cases must pass before the milestone can close? Owner: mobile team. Deadline: before milestone review.
