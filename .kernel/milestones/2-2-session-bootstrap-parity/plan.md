# Milestone Plan

## Goal

2.2 — Session bootstrap parity

## Approach

Establish storage and provider behavior first, then build boot-state transitions on top of that contract. The milestone focuses on launch truth: what data exists, how it is interpreted, and which destination the app chooses.

## Work Item Breakdown

| Work Item                                | Purpose                                                                             | Depends On                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| native-session-storage-and-auth-provider | Secure storage, provider lifecycle, auth headers, and sign-out behavior             | none                                     |
| native-boot-sequence-and-redirect-parity | Boot-state machine, profile recovery, expired-session handling, and redirect parity | native-session-storage-and-auth-provider |

## Critical Path

`native-session-storage-and-auth-provider` is the bottleneck because boot sequencing cannot be correct until the underlying session and header model is stable.

## Sequencing Rationale

Storage and provider behavior define the facts available at launch. Redirect and recovery logic depends on those facts, so boot sequencing follows only after the session model is settled.

## Deliverables

- Native session storage and auth-provider lifecycle behavior
- Boot-state machine for cold launch and returning-user restore
- Redirect parity for expired sessions, partial profiles, and signed-out launch

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Launch restore and redirect behavior match the Expo app for supported session states
- [ ] Auth-provider and request-header behavior are verified against protected access requirements

## Risks

| Risk                                                | Likelihood | Impact | Mitigation                                                                        |
| --------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------- |
| Session data model omits an Expo edge case          | Med        | High   | Enumerate bootstrap states and verify them explicitly against Expo before closure |
| Redirect parity is validated only on the happy path | Med        | High   | Include expired-session and partial-profile scenarios in acceptance review        |

## Open Questions

- What is the canonical signal that profile recovery is complete enough to enter the protected shell? Owner: mobile team. Deadline: before the boot-sequence work exits.
- Are any bootstrap transitions intentionally different on native due to platform constraints? Owner: mobile team. Deadline: before milestone sign-off.
