# Project Brief

## Goal

Phase 1 — Native Foundation: stand up the native iOS application shell so all subsequent phases can port features into a stable, production-configured app rather than a prototype.

## Target Date

2025-06-30

## Context

The Expo app is the current production iOS client. The migration to native Swift begins here: Phase 1 creates the Xcode project, configures all four build variants, ports the design system, builds the routing shell, and instruments observability — before any product surface is ported.

Current state: the Expo app has a working CI pipeline, four build variants (dev, e2e, preview, production), a theme system in `components/theme`, and PostHog + Sentry instrumentation. The native app does not yet exist.

When Phase 1 is done: the native app launches on real devices in all four variants, renders placeholder screens for every major route, has a design system that mirrors the Expo theme tokens, handles deep links, and emits telemetry. No user-visible product surfaces are implemented — that begins in Phase 2.

Completing Phase 1 unlocks: Auth work (Phase 2), which requires a functioning shell with correct bundle IDs, capabilities, and entitlements.

## Scope

### In scope

- Native Xcode project creation with `com.pontistudios.hakumi.dev`, `com.pontistudios.hakumi.e2e`, `com.pontistudios.hakumi.preview`, `com.pontistudios.hakumi` bundle identifiers
- Four build schemes: Debug/Dev, E2E, Preview, Production — each with matching xcconfig and environment injection
- App signing, capabilities, and entitlements for all four variants (aligned with current Expo `app.config.ts`)
- SwiftUI design token system: color palette, typography scale, spacing grid, surface styles, shadow levels, motion defaults
- Primitive component library: buttons, text inputs, cards, modals, form primitives — matching visual output of Expo equivalents
- Native root app container (`HakumiApp.swift`) with global providers and environment setup
- URL router with deep-link handling and placeholder screens for all major routes
- PostHog analytics integration with startup instrumentation matching current Expo events
- Sentry crash reporting with release configuration for each variant
- Performance tracing for cold start and TTID (Time to Interactive Display)
- App icon assets and launch screen for all four variants
- Brand assets migrated from Expo `assets/` directory

### Out of scope

- Any product surface implementation (inbox, notes, chat, settings, auth flows) — deferred to Phases 2+
- Android — iOS only
- Web fallback — remains in Expo
- SwiftUI scroll anchoring spike for feeds — will be prototyped in Phase 1 but not productized
- App Shortcuts, Control Center widget, app intents — Phase 5
- Push notification registration — Phase 5

## Success Criteria

This project is complete when:

- [ ] Native app launches on a real device in all four variants with correct bundle IDs verified via `xcrun instruments` or device console
- [ ] All four build schemes produce distinct binaries with matching entitlements to the current Expo configuration
- [ ] Design system renders all token categories (color, typography, spacing, surfaces) in a storybook-style preview screen accessible from the dev variant
- [ ] Primitive component library covers buttons (primary, secondary, ghost, destructive), text inputs (single line, multiline), cards, and modal presentation
- [ ] Deep link routing resolves `hakumi://` and `https://hakumi.app/` URLs into placeholder screens for all major routes without crashing
- [ ] PostHog receives `app_open`, `app_background`, and `cold_start_complete` events with correct variant tagging on every launch
- [ ] Sentry DSN is configured per variant; a test crash reports to the correct project
- [ ] p95 cold start time on an iPhone 12 is measured and documented as the Phase 1 baseline
- [ ] All milestones are delivered and marked done
- [ ] No critical or high-severity bugs remain open against this project

## Milestones

1. **1.1 — App bootstrap, variants, and design system** (target: 2025-05-15): Creates the Xcode project, all four variants with correct bundle IDs and entitlements, and ports the complete design token system and primitive component library. This comes first because everything else builds on the project structure and design primitives.
2. **1.2 — Routing shell, deep links, and observability** (target: 2025-06-15): Builds the native root app container, URL router with deep-link handling, placeholder screens, PostHog integration, Sentry, and startup performance tracing. This comes second because routing and observability require the project structure and component primitives from 1.1 to be stable.

## Stakeholders

| Stakeholder | Role | What They Care About |
|------------|------|---------------------|
| Mobile team | DRI | Correct variant config matching Expo; design token fidelity; not breaking live Expo in production |
| End users | Informed | No visible impact — migration must be invisible until Phase 6 cutover |

## Constraints

- iOS 15.1 minimum deployment target (matches current Expo `app.config.ts`; validate all SwiftUI APIs before using anything requiring iOS 16+)
- SwiftUI-first: UIKit is permitted only where SwiftUI cannot deliver the required behavior; every UIKit usage must be documented with justification
- Design tokens must be derived from the Expo theme source — no ad-hoc values introduced during port
- The Expo app must continue running in production unchanged throughout Phase 1
- No feature work may begin until Milestone 1.1 exits — no exceptions

## Dependencies

- Phase 0 contract freeze: API contracts and parity matrix are locked — confirmed complete
- Approved decision on SwiftUI-first architecture and UIKit escape hatch policy (needed before Milestone 1.1 begins)
- Backend passkey API contract documented (needed before Phase 2 begins; can be parallelized with Phase 1)
- Apple Developer account with correct team ID and certificate chain for all four bundle IDs
