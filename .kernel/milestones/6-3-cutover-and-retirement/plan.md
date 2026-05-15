# Milestone Plan

## Goal

6.3 — Cutover and retirement

## Approach

Prepare native release automation and the retirement checklist during late 6.2, then promote the native production path only after cutover approval. Retire Expo only after the agreed post-cutover observation window passes without rollback triggers. This keeps the native app fully supported before the old client is decommissioned.

## Work Item Breakdown

| Work Item                                     | Purpose                                                                          | Depends On                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| native-release-automation-replaces-expo-lanes | Native release automation and production support replace Expo lanes              | Late 6.2 rollout evidence and cutover approval                       |
| expo-retirement-docs-and-ownership-transfer   | Documentation, cleanup, and support ownership transfer retire Expo operationally | Native release authority established and observation window complete |

## Critical Path

`native-release-automation-replaces-expo-lanes` is the bottleneck because Expo cannot be retired until the native production path is authoritative and the team has completed the agreed observation period without triggering rollback.

## Sequencing Rationale

Production release support moves first so cutover has an already-working native path. Expo retirement follows only when the support model, documentation, cleanup plan, and post-cutover observation window are all complete.

## Deliverables

- Native release automation as the supported production path
- Operational cutover to the native client
- Expo retirement documentation, cleanup, and ownership transfer

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] The native app is the supported production client
- [ ] The agreed post-cutover observation window completes without rollback triggers
- [ ] Expo no longer carries release or support obligations

## Risks

| Risk                                                          | Likelihood | Impact | Mitigation                                                           |
| ------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Cutover succeeds technically but leaves operational ambiguity | Med        | High   | Make ownership transfer and runbooks part of milestone closure       |
| Expo retirement removes a needed fallback too early           | Med        | High   | Keep rollback and retirement checklist explicit until final sign-off |

## Open Questions

- Should Expo be deleted from the monorepo or archived behind a clear boundary after cutover? Owner: engineering leadership. Deadline: before retirement work exits.
- What post-cutover observation window is required before retirement is final? Owner: product and engineering leadership. Deadline: before milestone review.
