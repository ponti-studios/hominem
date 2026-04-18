# Project Brief

## Goal

Phase 2 — Auth and Shell

## Target Date

No date

## Context

Phase 2 rebuilds identity, onboarding, session recovery, and protected navigation so the native app can safely host real product traffic. It is the first user-facing project after the native foundation is in place.

Current state: the Expo app contains the full auth stack, boot sequence, onboarding flow, protected route gating, tab shell, app lock preferences, and screenshot-protection settings foundations. The native app cannot host migrated product surfaces until these semantics exist outside Expo.

When Phase 2 is done: a signed-out user can authenticate with the same supported methods, a returning user resumes into the correct route, onboarding behaves consistently, and the protected shell is stable enough to host placeholder or migrated routes for inbox, notes, chat, and settings.

Completing Phase 2 unlocks: Phase 3 and every later product phase, because all migrated surfaces depend on a working session bootstrap and protected shell.

## Scope

### In scope

- Public auth stack parity for sign-in, OTP verification, and auth-screen branching
- Native auth provider, secure storage integration, session restore, sign-out, and passkey lifecycle
- Native recreation of the auth machine, boot sequence, and auth-header semantics
- Protected shell, route guard, onboarding flow, and tab shell parity
- App lock and screenshot-preference foundations needed by later settings and device-feature work

### Out of scope

- Inbox, notes, settings, chat, and composer product delivery beyond shell placeholders
- Media capture and Apple-integrated surfaces
- Release cutover and Expo retirement

## Success Criteria

This project is complete when:

- [ ] A signed-out user can sign in with the same supported methods as the Expo app
- [ ] A returning user restores into the correct protected route with matching redirect behavior
- [ ] Onboarding parity is confirmed for new profiles and existing profiles
- [ ] The protected shell and tab shell can host placeholders for inbox, notes, chat, and settings routes
- [ ] App lock and screenshot-related preference wiring is in place for later phases
- [ ] All milestones are delivered and marked done

## Milestones

1. **2.1 — Public auth parity** (target: TBD): native public auth stack supports email flow, OTP verification, and passkey sign-in.
2. **2.2 — Session bootstrap parity** (target: TBD): native boot sequence restores sessions, performs profile recovery, and reproduces current auth redirect behavior.
3. **2.3 — Protected shell readiness** (target: TBD): protected shell, onboarding, and tab shell are stable enough to host migrated product routes.

## Stakeholders

| Stakeholder  | Role      | What They Care About                                                                  |
| ------------ | --------- | ------------------------------------------------------------------------------------- |
| Mobile team  | DRI       | Exact auth parity, low-risk boot behavior, and a shell stable enough for later phases |
| Backend team | Consulted | Better Auth and passkey contract fidelity                                             |
| End users    | Informed  | Seamless sign-in, restore, and onboarding behavior                                    |

## Constraints

- Auth semantics must remain aligned with the existing backend contract
- Protected-route behavior must match the Expo app, including edge-case redirects
- Secure storage and session persistence must be safe by default and observable during testing
- No feature phase can bypass Phase 2 behavior with ad-hoc login or shell shortcuts

## Dependencies

- Phase 1 native foundation
- Frozen backend auth endpoints, cookie semantics, and passkey contract
