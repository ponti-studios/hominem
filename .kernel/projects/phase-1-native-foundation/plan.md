# Project Plan

## Goal

Phase 1 — Native Foundation

## Approach

Two milestones, strictly sequential. Milestone 1.1 delivered a buildable Xcode project and the complete design layer. Milestone 1.2 built the runtime shell on top of it: routing, deep links, and observability. No feature work was started until both milestones were closed.

Key decisions made during execution:

- **iOS minimum: 18.0** — validated against the APIs used in the native shell, including `ScrollPosition`. The project target and generated Xcode settings now match this baseline.
- **XcodeGen** — `project.yml` is the single source of truth for the Xcode project. Running `xcodegen generate` in `apps/native/` regenerates the `.xcodeproj` at any time.
- **Architecture: `@Observable` + async/await** — TCA was evaluated and rejected. The `@Observable` macro with structured concurrency gives us full SwiftUI integration without an external dependency and matches the existing codebase's data-flow patterns.
- **PostHog handles crash reporting** — no Sentry. Matches Expo's pattern exactly; PLCrashReporter is pulled in transitively by the PostHog SDK.

## Milestone Breakdown

| Milestone                                          | Purpose                                                                          | Depends On | Status  |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------- |
| 1.1 — App bootstrap, variants, and design system   | Buildable Xcode project, 4 variants, design tokens, primitive components         | none       | ✅ done |
| 1.2 — Routing shell, deep links, and observability | Root container, placeholder routes, deep-link parsing, PostHog + startup metrics | 1.1        | ✅ done |

## Critical Path

1.1 was the absolute bottleneck — nothing could be built without a compilable Xcode project. 1.2 depended on 1.1 entirely.

## Sequencing Rationale

Design tokens had to precede primitive components (tokens are consumed by components). The routing shell had to precede observability (PostHog needed a stable lifecycle to instrument). All work items were completed in dependency order with no parallel tracks needed at this phase size.

## Risks

| Risk                                           | Likelihood | Impact | Mitigation                                                        |
| ---------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| iOS version open question blocking API choices | High       | High   | Resolved: bumped to iOS 18.0                                      |
| Architecture pattern (TCA vs Observation)      | High       | High   | Resolved: `@Observable` + async/await chosen                      |
| Token drift between Expo and native            | Med        | Med    | Tokens extracted verbatim from `packages/platform/ui/src/tokens/` |

## Acceptance Criteria

This project is complete when:

- [x] Milestone 1.1 done — Xcode project, 4 variants, design system, primitive components
- [x] Milestone 1.2 done — routing shell, deep links, observability
- [x] All work items marked done
- [ ] Retrospective captured in `kernel/retrospectives/`
